export function BoardArt() {
  return <div className="board-art" aria-hidden="true"><div className="wood-grain" /><div className="art-board">
    {Array.from({ length: 81 }, (_, i) => <span key={i} className={`board-square ${[0, 8, 72, 80, 40].includes(i) ? 'rose' : [10, 16, 64, 70, 30, 50].includes(i) ? 'sage' : [20, 24, 56, 60].includes(i) ? 'blue' : ''}`} />)}
    <div className="board-word">{'TOGETHER'.split('').map((c, i) => <span className="art-tile" key={i}>{c}<sub>{c === 'H' ? 4 : c === 'G' ? 2 : 1}</sub></span>)}</div>
  </div><div className="art-cup"><div className="coffee" /></div><div className="art-rack">{'ONE MORE'.split('').map((c, i) => c === ' ' ? <span className="rack-gap" key={i} /> : <span className="art-tile" key={i}>{c}<sub>{c === 'M' ? 3 : 1}</sub></span>)}</div><span className="loose-tile art-tile">G<sub>2</sub></span><span className="art-note">Always room for one more.</span></div>;
}
