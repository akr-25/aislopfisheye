import { ChevronLeftIcon } from "../components/Icons.jsx";

export default function About({ onBack }) {
  return (
    <div className="page page--top">
      <div className="nav-bar">
        <button className="nav-back btn" onClick={onBack}>
          <ChevronLeftIcon />
          Back
        </button>
      </div>

      <div className="stack stack--20 about-container w-full about-scroll">
        <div className="stack stack--8">
          <h1 className="t-title1">About FishCall</h1>
          <p className="t-body t-secondary">
            FishCall is a privacy-first WebRTC video calling app with realtime fisheye video
            processing and optional helium voice modulation.
          </p>
        </div>

        <section className="card stack stack--12">
          <h2 className="t-title3">Core stack</h2>
          <ul className="about-list">
            <li><strong>React + Vite</strong> for the client UI and build pipeline.</li>
            <li><strong>WebRTC</strong> for peer-to-peer media transport.</li>
            <li><strong>WebSocket signaling</strong> (Express + ws) for room lifecycle and SDP/ICE relay.</li>
            <li><strong>WebGL shader pipeline</strong> for fisheye rendering on every outgoing frame.</li>
            <li><strong>AudioWorklet</strong> for low-latency pitch shifting (helium mode).</li>
          </ul>
        </section>

        <section className="card stack stack--12">
          <h2 className="t-title3">Feature implementation details</h2>
          <ul className="about-list">
            <li>
              <strong>Fisheye effect (fixed max):</strong> the local camera stream is fed into
              a hidden video element, rendered via <code>FisheyeRenderer</code> onto a canvas,
              then the canvas stream (<code>captureStream(30)</code>) is sent over WebRTC.
            </li>
            <li>
              <strong>Helium voice:</strong> microphone input is routed through an AudioWorklet
              processor and the peer connection audio sender swaps tracks using
              <code>RTCRtpSender.replaceTrack()</code>.
            </li>
            <li>
              <strong>Pre-join preview:</strong> users get local camera + mic meter validation
              before join/create, and their stream is passed forward into the call flow.
            </li>
            <li>
              <strong>Room rejoin:</strong> server keeps room state for 30 seconds after disconnect
              and accepts <code>rejoin-room</code> for known previous participants.
            </li>
            <li>
              <strong>Share UX:</strong> waiting room exposes one-tap copy for room code and full URL
              (<code>?join=ROOMCODE</code>) for direct deep-link join.
            </li>
            <li>
              <strong>Frequent contacts:</strong> stored client-side only in <code>localStorage</code>
              with recency/frequency ranking; no contact data is persisted on the server.
            </li>
            <li>
              <strong>Mobile install support:</strong> manifest metadata is exposed via
              <code>client/public/manifest.json</code> and linked in <code>client/index.html</code>.
            </li>
          </ul>
        </section>

        <section className="card stack stack--12">
          <h2 className="t-title3">Privacy model</h2>
          <ul className="about-list">
            <li>Media streams are peer-to-peer via WebRTC after signaling.</li>
            <li>Server handles signaling and room coordination only.</li>
            <li>Contacts and UUID are stored in browser localStorage on-device.</li>
          </ul>
        </section>

        <section className="card stack stack--12">
          <h2 className="t-title3">Operational notes</h2>
          <ul className="about-list">
            <li>HTTPS is recommended for full mobile camera/mic compatibility.</li>
            <li>TURN is not configured by default (STUN-only), so restrictive NATs may fail.</li>
            <li>The app is optimized for 1:1 calls and low-latency interaction.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
