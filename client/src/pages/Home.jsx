export default function Home({ onCreateRoom, onJoinRoom }) {
  return (
    <div className="page">
      <div className="stack stack--40 center max-400">

        {/* Brand */}
        <div className="stack stack--8 center">
          <span style={{ fontSize: 64, lineHeight: 1 }}>🐟</span>
          <h1 className="t-largeTitle">FishCall</h1>
          <p className="t-body t-secondary">Video calls with a fisheye twist.</p>
        </div>

        {/* Actions */}
        <div className="stack stack--12 w-full">
          <button className="btn btn-primary" onClick={onCreateRoom}>
            New Room
          </button>

          <div className="separator">or</div>

          <button className="btn btn-secondary" onClick={onJoinRoom}>
            Join a Room
          </button>
        </div>

      </div>
    </div>
  )
}
