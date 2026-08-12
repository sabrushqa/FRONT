import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSessionStore } from '../../../../store/sessionStore';
import api from '../../../../core/api';
import { resolveBackendApiUrl } from '../../../../core/apiUrl';
import '../../../../styles/commercant-reclamations.scss';

// ── Config ────────────────────────────────────────────────────────────────────
// Le chat est relaye par le backend Spring (proxy /api/merchant/chatbot/**) afin
// que le secret partage avec le microservice chatbot ne soit jamais expose au navigateur.
// Passe par le client axios partage (`api`) plutot que fetch() brut : son
// intercepteur rafraichit le token Keycloak proche de l'expiration
// (accessTokenLifespan tres court, ~5 min). Avec fetch() + le token lu une
// fois dans le store, un commerçant reste sur cette page de chat sans jamais
// declencher d'autre appel axios ailleurs dans l'app -> le token expire
// silencieusement -> 401 systematique des le 1er message ("Chatbot inaccessible").
const CHATBOT_URL = resolveBackendApiUrl('/api/merchant/chatbot');
const RECLAMATIONS_URL = resolveBackendApiUrl('/api/merchant/reclamations');
const BOT_NAME     = 'Lana Assist';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Msg {
  id: number;
  from: 'bot' | 'user';
  text: string;
  time: string;
  ticket?: Ticket;
  imageSrc?: string;
  audioLabel?: string;
}
interface Ticket {
  ticket_id: string;
  incident_type: string;
  priority: string;
  summary: string;
}
interface InfoMap { [k: string]: unknown }

// ── Helpers ───────────────────────────────────────────────────────────────────
const ts = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const isRTL = (t: string) => /[؀-ۿ]/.test(t);
// Certains TPE n'ont pas de vrai nom de modèle enregistré (modele = "TPE",
// une valeur de type générique plutôt qu'une marque) — préfixer "TPE" dans
// ce cas donne "TPE TPE (#...)". On ne préfixe que si le modèle apporte une
// info distincte de "c'est un TPE" (déjà évident dans le contexte du picker).
function formatTpeLabel(tpe: { modele: string; numeroSerie: string }): string {
  const modele = (tpe.modele || '').trim();
  const isGenericModele = !modele || modele.toUpperCase() === 'TPE';
  return isGenericModele ? `TPE #${tpe.numeroSerie}` : `${modele} (#${tpe.numeroSerie})`;
}
const PRIO_LABELS: Record<string, string> = {
  critical: '🔴 Critique', high: '🟠 Haute', medium: '🟡 Moyenne', low: '🟢 Basse'
};
const INFO_DISPLAY: Array<[string, string, string]> = [
  ['error_code','⚠️','Erreur'], ['connection_type','📡','Connexion'],
  ['operator','📱','Opérateur'], ['duration','⏱️','Depuis'],
  ['tpe_model','💳','Modèle'], ['tpe_reference','🔢','Réf. TPE'],
];

// ── WAV encoder (no ffmpeg needed) ───────────────────────────────────────────
function encodeWAV(samples: Float32Array, sr: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v   = new DataView(buf);
  const w   = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+samples.length*2,true);
  w(8,'WAVE'); w(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true);  v.setUint16(34,16,true);
  w(36,'data'); v.setUint32(40,samples.length*2,true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
async function toWAV(blob: Blob): Promise<Blob> {
  const ab  = await blob.arrayBuffer();
  const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const dec = await ctx.decodeAudioData(ab);
  const ch0 = dec.getChannelData(0);
  const mono = dec.numberOfChannels > 1
    ? (() => { const c1 = dec.getChannelData(1); const out = new Float32Array(ch0.length); for (let i=0;i<out.length;i++) out[i]=(ch0[i]+c1[i])/2; return out; })()
    : ch0;
  await ctx.close();
  return encodeWAV(mono, dec.sampleRate);
}

type TpeOption = NonNullable<ReturnType<typeof useSessionStore.getState>['session']>['tpes'][number];

// ── Component ─────────────────────────────────────────────────────────────────
export default function CommercantReclamationsPage() {
  const { session } = useSessionStore();

  const merchantName = session?.profile?.nom  || session?.nom  || 'Commerçant';
  const phone        = session?.profile?.telephone || '';
  const ville        = session?.profile?.ville || '';
  const adresse      = (session?.pdvs?.[0]?.adresse) || '';
  const location     = [adresse, ville].filter(Boolean).join(', ');

  const [msgs,       setMsgs]       = useState<Msg[]>([]);
  const [draft,      setDraft]      = useState('');
  const [typing,     setTyping]     = useState(false);
  const [sid,        setSid]        = useState<string | null>(null);
  const [info,       setInfo]       = useState<InfoMap>({});
  const [recording,  setRecording]  = useState(false);
  const [recLabel,   setRecLabel]   = useState('');
  const [ticketDone, setTicketDone] = useState(false);
  const [prefilled,  setPrefilled]  = useState(false);

  // Le commerçant doit choisir EXPLICITEMENT le TPE concerné avant de
  // discuter (réduit l'hallucination LLM : sans ça le bot devine/redemande
  // le modèle, ou pire, traite un message "e-commerce" comme un problème du
  // TPE — vu en réel). null = pas encore choisi ; s'il n'a aucun TPE
  // (commerçant e-commerce pur), on saute directement le picker.
  const hasTpes = (session?.tpes?.length ?? 0) > 0;
  const [selectedTpe, setSelectedTpe] = useState<TpeOption | null>(null);
  const tpePdv = selectedTpe
    ? session?.pdvs?.find(p => p.id === selectedTpe.pdvId)
    : undefined;

  const threadRef    = useRef<HTMLDivElement>(null);
  const recRef       = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const fileRef      = useRef<HTMLInputElement>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const secsRef      = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoie le minuteur de fermeture de session si le composant se demonte
  // pendant le delai (evite un setState apres unmount).
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (threadRef.current)
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [msgs, typing]);

  // ── Init: welcome + prefill ──────────────────────────────────────────────────
  const initChat = useCallback(async () => {
    const tpeMention = selectedTpe
      ? `\nConcernant votre **${formatTpeLabel(selectedTpe)}**${tpePdv ? ` — ${tpePdv.nom}, ${tpePdv.ville}` : ''}.`
      : '';
    setMsgs([{
      id: 0, from: 'bot', time: ts(),
      text: `Bonjour ${merchantName} ! Je suis **Lana Assist**.${tpeMention}\nDécrivez votre problème — je m'occupe du reste 🤝\n_Darija · Français · English_`
    }]);
    setSid(null); setInfo({}); setTicketDone(false); setPrefilled(false);
  }, [merchantName, selectedTpe, tpePdv]);

  // Ne demarre la conversation qu'une fois le choix du TPE fait (ou d'emblee
  // s'il n'y a rien a choisir — commerçant e-commerce pur).
  useEffect(() => {
    if (hasTpes && !selectedTpe) return;
    initChat();
  }, [initChat, hasTpes, selectedTpe]);

  function chooseTpe(tpe: TpeOption) {
    setSelectedTpe(tpe);
  }

  function changeTpe() {
    setSelectedTpe(null);
  }

  // Prefill session once we have a session_id (ou re-prefill si le
  // commerçant change de TPE en cours de route — voir changeTpe()).
  useEffect(() => {
    if (!sid || prefilled) return;
    setPrefilled(true);

    const params = new URLSearchParams();
    params.set('session_id', sid);
    if (phone)        params.set('phone', phone);
    if (merchantName) params.set('merchant_name', merchantName);
    if (location)     params.set('location', location);
    if (ville)         params.set('commercant_ville', ville);
    if (selectedTpe) {
      params.set('tpe_id',    selectedTpe.numeroSerie);
      params.set('tpe_model', selectedTpe.modele);
      if (tpePdv) {
        params.set('pdv_nom',   tpePdv.nom);
        params.set('pdv_ville', tpePdv.ville);
      }
    }

    api.post(`${CHATBOT_URL}/session/prefill`, null, { params })
      .catch(() => {/* silent */});
  }, [sid, prefilled, phone, merchantName, location, ville, selectedTpe, tpePdv]);

  // ── Send text ───────────────────────────────────────────────────────────────
  async function sendText(text: string) {
    const t = text.trim();
    if (!t || typing) return;
    setDraft('');
    pushUserMsg({ text: t });
    await callChat({ message: t });
  }

  // ── Send image ──────────────────────────────────────────────────────────────
  async function sendImage(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target?.result as string;
      pushUserMsg({ text: '📸 Photo envoyée', imageSrc: src });
      setTyping(true);
      const form = new FormData();
      form.append('image', file);
      form.append('message', 'photo');
      if (sid) form.append('session_id', sid);
      try {
        const { data } = await api.post(`${CHATBOT_URL}/message-with-image`, form);
        handleReply(data);
      } catch { setTyping(false); pushBotMsg('⚠️ Erreur envoi image.'); }
    };
    reader.readAsDataURL(file);
  }

  // ── Voice recording ─────────────────────────────────────────────────────────
  async function toggleRecording() {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecLabel('');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      pushBotMsg('⚠️ Micro indisponible — accédez via **http://localhost** (pas 127.0.0.1).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      secsRef.current   = 0;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec  = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (chunksRef.current.length === 0) return;
        const raw = new Blob(chunksRef.current, { type: rec.mimeType });
        try {
          const wav = await toWAV(raw);
          await sendAudio(wav);
        } catch { pushBotMsg('⚠️ Erreur conversion audio.'); }
      };
      rec.start(100);
      setRecording(true);

      timerRef.current = setInterval(() => {
        secsRef.current++;
        const m = String(Math.floor(secsRef.current / 60)).padStart(2,'0');
        const s = String(secsRef.current % 60).padStart(2,'0');
        setRecLabel(`${m}:${s}`);
      }, 1000);
    } catch {
      pushBotMsg('⚠️ Microphone non autorisé — activez-le dans les paramètres du navigateur.');
    }
  }

  async function sendAudio(wav: Blob) {
    setTyping(true);
    const form = new FormData();
    form.append('audio', wav, 'voice.wav');
    if (sid) form.append('session_id', sid);
    try {
      const { data: d } = await api.post(`${CHATBOT_URL}/audio`, form);
      // v2 renvoie directement `transcription` (voir agent/routers/chat.py) —
      // le front cherchait avant un champ "suggestions" hérité du contrat
      // v1, jamais implémenté côté v2 : la transcription n'était donc
      // jamais affichée, quel que soit le message vocal envoyé.
      if (d.transcription) pushUserMsg({ text: '', audioLabel: d.transcription });
      handleReply(d);
    } catch (err: any) {
      setTyping(false);
      pushBotMsg(`⚠️ ${err?.response?.data?.detail || 'Erreur transcription.'}`);
    }
  }

  // ── Core chat call ─────────────────────────────────────────────────────────
  async function callChat(body: Record<string, string>) {
    setTyping(true);
    if (sid) body.session_id = sid;
    try {
      const { data: d } = await api.post(`${CHATBOT_URL}/message`, body);
      handleReply(d);
    } catch { setTyping(false); pushBotMsg('⚠️ Chatbot inaccessible.'); }
  }

  function handleReply(d: any) {
    setTyping(false);
    if (!d) return;
    if (d.session_id) setSid(d.session_id);
    pushBotMsg(d.message, d.ticket);

    // Refresh info bar from collected_info returned directly in the response
    if (d.collected_info) {
      const ci = d.collected_info as Record<string, unknown>;
      setInfo(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(ci))
          if (v != null && v !== '' && k !== 'lang' && k !== 'symptom_text')
            next[k] = v as string;
        return next;
      });
    }

    // Ticket → save to Spring Boot
    if (d.ticket && !ticketDone) {
      setTicketDone(true);
      saveTicket(d.ticket);
    }

    // Le commerçant a confirmé que c'est réglé ("oui merci"...) ou un
    // ticket vient d'être créé (escalade) : la conversation est close côté
    // agent (v2 -> orchestrator.process_message::session_closed). Laisse le
    // temps de lire le dernier message, puis ferme la session et revient
    // au choix de TPE (ou juste repart à zéro pour un commerçant e-commerce
    // pur, qui n'a pas de TPE à choisir).
    if (d.session_closed) {
      pushBotMsg('↩️ Session terminée — vous pouvez démarrer une nouvelle demande.');
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (hasTpes) setSelectedTpe(null);
        else initChat();
      }, 2500);
    }
  }

  async function saveTicket(ticket: Ticket) {
    // Le TPE explicitement choisi par le commerçant avant la conversation
    // (picker) est la source la plus fiable — plus besoin de retrouver le
    // TPE via l'info bar (info.tpe_reference), qui dépendait de ce que le
    // LLM avait ou non extrait du texte.
    await api.post(RECLAMATIONS_URL, {
      referenceChat: ticket.ticket_id,
      typeProbleme:  ticket.incident_type,
      description:   ticket.summary,
      priorite:      ticket.priority,
      tpeId:         selectedTpe?.id ?? null,
      commentaire:   null,
    }).catch(() => {});
  }

  // ── Msg helpers ─────────────────────────────────────────────────────────────
  function pushUserMsg(o: { text: string; imageSrc?: string; audioLabel?: string }) {
    setMsgs(m => [...m, { id: m.length+1, from:'user', time:ts(), ...o }]);
  }
  function pushBotMsg(text: string, ticket?: Ticket) {
    setMsgs(m => [...m, { id: m.length+1, from:'bot', time:ts(), text, ticket }]);
  }

  function renderText(t: string) {
    // Bold **text** and line breaks
    return t.split(/\n/).map((line, li) => (
      <React.Fragment key={li}>
        {li > 0 && <br />}
        {line.split(/\*\*(.*?)\*\*/g).map((seg, si) =>
          si % 2 === 1 ? <b key={si}>{seg}</b> : <React.Fragment key={si}>{seg}</React.Fragment>
        )}
      </React.Fragment>
    ));
  }

  // ── Info bar chips (only technical — contact info hidden since auto-collected) ──
  const chips = INFO_DISPLAY.filter(([k]) => info[k] != null && info[k] !== '');

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="lc-reclam">

      {/* ── Info bar ── */}
      {chips.length > 0 && (
        <div className="lc-infobar">
          <span className="lc-ib-label">Diagnostic :</span>
          {chips.map(([k, icon, label]) => (
            <span key={k} className="lc-ib-chip">
              {icon} <b>{label}</b> {String(info[k])}
            </span>
          ))}
        </div>
      )}

      <div className="lc-layout">

        {/* ── Chat panel ── */}
        <div className="lc-chat">

          {/* Header */}
          <div className="lc-chat-head">
            <div className="lc-avatar">
              <img src="/logo.png" alt="Lana" />
              <span className="lc-dot" />
            </div>
            <div className="lc-head-info">
              <span className="lc-head-name">{BOT_NAME}</span>
              <span className="lc-head-sub">Support TPE · FR · Darija · عربي · EN</span>
            </div>
            <button className="lc-btn-icon" title="Nouvelle conversation" onClick={initChat}>
              <span className="material-icons">refresh</span>
            </button>
          </div>

          {/* Merchant context pill */}
          <div className="lc-ctx-pill">
            <span className="material-icons">verified_user</span>
            {merchantName}
            {selectedTpe && ` · ${formatTpeLabel(selectedTpe)}`}
            {tpePdv && ` · ${tpePdv.nom}, ${tpePdv.ville}`}
            {!selectedTpe && ville && ` · ${ville}`}
            {selectedTpe && (
              <button type="button" className="lc-change-tpe" onClick={changeTpe}>
                Changer de TPE
              </button>
            )}
          </div>

          {/* TPE picker — le commerçant doit choisir EXPLICITEMENT le TPE
              concerné avant de pouvoir discuter, pour que l'agent reçoive un
              contexte fiable (réduit l'hallucination) plutôt que de deviner. */}
          {hasTpes && !selectedTpe ? (
            <div className="lc-tpe-picker">
              <p className="lc-tpe-picker-title">Quel TPE est concerné ?</p>
              <p className="lc-tpe-picker-sub">
                Choisissez le terminal pour lequel vous rencontrez un problème.
              </p>
              <div className="lc-tpe-picker-grid">
                {session?.tpes?.map(t => {
                  const pdv = session?.pdvs?.find(p => p.id === t.pdvId);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="lc-tpe-pick-card"
                      onClick={() => chooseTpe(t)}
                    >
                      <div className="lc-tpe-icon">💳</div>
                      <div>
                        <div className="lc-tpe-model">{t.modele}</div>
                        <div className="lc-tpe-serial">#{t.numeroSerie}</div>
                        {pdv && <div className="lc-tpe-meta">{pdv.nom}, {pdv.ville}</div>}
                        <span className={`lc-tpe-statut lc-tpe-${t.statut?.toLowerCase()}`}>{t.statut}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <>
          {/* Thread */}
          <div className="lc-thread" ref={threadRef}>
            {msgs.map(msg => (
              <div key={msg.id} className={`lc-msg lc-msg--${msg.from}`}>
                {msg.from === 'bot' && (
                  <div className="lc-msg-av"><img src="/logo.png" alt="" /></div>
                )}
                <div className={`lc-bubble${isRTL(msg.text) ? ' rtl' : ''}`}>
                  {msg.imageSrc && (
                    <img src={msg.imageSrc} className="lc-img-prev" alt="TPE" />
                  )}
                  {msg.audioLabel && (
                    <div className="lc-audio-pill">
                      <span className="material-icons">mic</span>
                      <span>{msg.audioLabel}</span>
                    </div>
                  )}
                  {msg.text && <p>{renderText(msg.text)}</p>}
                  {msg.ticket && (
                    <div className="lc-ticket">
                      <div className="lc-ticket-head">
                        <span className="lc-tid">🎫 {msg.ticket.ticket_id}</span>
                        <span className={`lc-tprio lc-tp-${(msg.ticket.priority||'medium').toLowerCase()}`}>
                          {PRIO_LABELS[(msg.ticket.priority||'medium').toLowerCase()] || msg.ticket.priority}
                        </span>
                      </div>
                      <pre className="lc-tdesc">{msg.ticket.summary}</pre>
                      {ticketDone && (
                        <div className="lc-tsaved">
                          <span className="material-icons" style={{fontSize:14}}>check_circle</span>
                          Réclamation enregistrée dans votre espace
                        </div>
                      )}
                    </div>
                  )}
                  <span className="lc-time">{msg.time}</span>
                </div>
                {msg.from === 'user' && (
                  <div className="lc-msg-av lc-msg-av--user">
                    <span className="material-icons">person</span>
                  </div>
                )}
              </div>
            ))}

            {typing && (
              <div className="lc-msg lc-msg--bot">
                <div className="lc-msg-av"><img src="/logo.png" alt="" /></div>
                <div className="lc-bubble lc-typing">
                  <span/><span/><span/>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="lc-composer">
            {/* Image */}
            <button className="lc-btn-icon" title="Joindre une photo" onClick={() => fileRef.current?.click()}>
              <span className="material-icons">add_photo_alternate</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value=''; }} />

            {/* Input */}
            <input
              className="lc-input"
              placeholder="Décrivez votre problème… (FR · Darija · EN)"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendText(draft); }}}
              disabled={typing}
            />

            {/* Mic */}
            <button
              className={`lc-mic-btn${recording ? ' lc-mic-btn--on' : ''}`}
              title={recording ? `Arrêter (${recLabel})` : 'Message vocal'}
              onClick={toggleRecording}
            >
              {recording
                ? <><span className="material-icons">stop</span><span className="lc-rec-label">{recLabel}</span></>
                : <span className="material-icons">mic</span>
              }
            </button>

            {/* Send */}
            {draft.trim() && (
              <button className="lc-send" onClick={() => sendText(draft)} disabled={typing}>
                <span className="material-icons">send</span>
              </button>
            )}
          </div>
          </>
          )}
        </div>

        {/* ── Side panel ── */}
        <aside className="lc-side">

          {/* Merchant info card */}
          <div className="lc-side-card">
            <div className="lc-side-head">
              <span className="material-icons">storefront</span>
              <span>Votre profil</span>
            </div>
            <div className="lc-side-body">
              <div className="lc-srow"><span className="material-icons">person</span>{merchantName}</div>
              {phone    && <div className="lc-srow"><span className="material-icons">phone</span>{phone}</div>}
              {ville    && <div className="lc-srow"><span className="material-icons">location_on</span>{ville}</div>}
              {adresse  && <div className="lc-srow lc-srow--sub"><span className="material-icons">navigate_next</span>{adresse}</div>}

            </div>
          </div>

          {/* TPE list */}
          {session?.tpes && session.tpes.length > 0 && (
            <div className="lc-side-card">
              <div className="lc-side-head">
                <span className="material-icons">point_of_sale</span>
                <span>Mes terminaux ({session.tpes.length})</span>
              </div>
              <div className="lc-side-body" style={{gap:6}}>
                {session.tpes.map(t => (
                  <div key={t.id} className="lc-tpe-row">
                    <div className="lc-tpe-icon">💳</div>
                    <div>
                      <div className="lc-tpe-model">{t.modele}</div>
                      <div className="lc-tpe-serial">#{t.numeroSerie}</div>
                      <div className="lc-tpe-meta">{t.typeConnexion} · <span className={`lc-tpe-statut lc-tpe-${t.statut?.toLowerCase()}`}>{t.statut}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          <div className="lc-side-card">
            <div className="lc-side-head">
              <span className="material-icons">support_agent</span>
              <span>Support direct</span>
            </div>
            <div className="lc-side-body">
              <div className="lc-srow"><span className="material-icons">call</span>+212 5XX-XXX-XXX</div>
              <div className="lc-srow"><span className="material-icons">email</span>support@lanacash.ma</div>
              <div className="lc-srow"><span className="material-icons">schedule</span>Lun–Ven 8h–18h</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
