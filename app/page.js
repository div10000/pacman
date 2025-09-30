"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./Pacman.module.css";

// --- CONFIGURATION & CONSTANTS ---
const ROWS = 21;
const COLS = 19;

/**
 * GHOST_SPEED_RATIO controls how often the ghosts move relative to Pac-Man.
 * 1 = Ghosts move every game tick (same speed as Pac-Man).
 * 2 = Ghosts move every 2nd game tick (half speed).
 * 3 = Ghosts move every 3rd game tick (one-third speed).
 */
const GHOST_SPEED_RATIO = 4;

// Tile types: 0=empty, 1=wall, 2=dot, 3=ghost house, 4=power pellet
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,2,1],
  [1,4,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,4,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,2,1,1,1,2,1,2,1,1,1,2,1],
  [1,2,2,2,2,2,1,2,2,1,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,1,2,1,1,1,0,1,1,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,1,1,0,1,2,1,1,1,1,1],
  [2,2,2,2,2,2,0,0,1,3,1,0,0,2,2,2,2,2,2],
  [1,1,1,1,1,2,1,0,1,1,1,0,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,1,1,0,1,2,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,2,1],
  [1,4,2,2,1,2,2,2,2,2,2,2,2,2,1,2,2,4,1],
  [1,1,1,2,1,2,1,2,1,1,1,2,1,2,1,2,1,1,1],
  [1,2,2,2,2,2,1,2,2,1,2,2,1,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const DIRS = {
  ArrowUp:    { x: 0, y: -1, angle: 270 },
  ArrowDown:  { x: 0, y: 1,  angle: 90  },
  ArrowLeft:  { x: -1, y: 0, angle: 180 },
  ArrowRight: { x: 1, y: 0,  angle: 0   },
};

const GHOSTS_INITIAL = [
    { id: 'blinky', x: 9, y: 9, dir: DIRS.ArrowLeft, color: '#FF0000' },
    { id: 'pinky',  x: 8, y: 10, dir: DIRS.ArrowUp, color: '#FFB8FF' },
    { id: 'inky',   x: 9, y: 10, dir: DIRS.ArrowUp, color: '#00FFFF' },
    { id: 'clyde',  x: 10, y: 10, dir: DIRS.ArrowUp, color: '#FFB852' },
];

const isWall = (x, y) => MAP[y] && MAP[y][x] === 1;

const getInitialDots = () => MAP.map(row => row.map(cell => cell === 2 || cell === 4));

function PacmanGame() {
    // --- STATE ---
    const [tileSize, setTileSize] = useState(24);
    const [pacman, setPacman] = useState({ x: 9, y: 16, dir: DIRS.ArrowLeft });
    const [ghosts, setGhosts] = useState(JSON.parse(JSON.stringify(GHOSTS_INITIAL)));
    const [dots, setDots] = useState(getInitialDots());
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState("playing");
    const [mouthAngle, setMouthAngle] = useState(0);
    const animTickRef = useRef(0);
    
    // --- REFS ---
    const gameLoopRef = useRef();
    const requestedDirRef = useRef(DIRS.ArrowLeft);
    const tickCountRef = useRef(0); // For controlling ghost speed

    // --- DYNAMIC TILE SIZING ---
    useEffect(() => {
        const updateTileSize = () => {
            const headerHeight = 150;
            const availableWidth = window.innerWidth * 0.95;
            const availableHeight = window.innerHeight - headerHeight;
            
            const newTileSize = Math.floor(Math.min(availableWidth / COLS, availableHeight / ROWS));
            setTileSize(newTileSize);
        };

        updateTileSize();
        window.addEventListener('resize', updateTileSize);
        return () => window.removeEventListener('resize', updateTileSize);
    }, []);
    
    // --- GAME RESET ---
    const resetGame = useCallback(() => {
        setPacman({ x: 9, y: 16, dir: DIRS.ArrowLeft });
        setGhosts(JSON.parse(JSON.stringify(GHOSTS_INITIAL)));
        setDots(getInitialDots());
        setScore(0);
        setGameState("playing");
        requestedDirRef.current = DIRS.ArrowLeft;
        tickCountRef.current = 0;
    }, []);

    // --- INPUT HANDLING ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (DIRS[e.key]) {
                requestedDirRef.current = DIRS[e.key];
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // --- GAME LOOP ---
    useEffect(() => {
        const gameTick = () => {
            if (gameState !== "playing") return;

            tickCountRef.current++; // Increment tick counter

            // --- PAC-MAN MOVEMENT (every tick) ---
            setPacman(p => {
                let nextPos = { x: p.x + requestedDirRef.current.x, y: p.y + requestedDirRef.current.y };
                if (!isWall(nextPos.x, nextPos.y)) {
                    p.dir = requestedDirRef.current;
                } else {
                    nextPos = { x: p.x + p.dir.x, y: p.y + p.dir.y };
                    if (isWall(nextPos.x, nextPos.y)) return p;
                }
                
                if (nextPos.x === -1 && nextPos.y === 10) nextPos.x = COLS - 1;
                if (nextPos.x === COLS && nextPos.y === 10) nextPos.x = 0;
                
                p.x = nextPos.x;
                p.y = nextPos.y;
                return { ...p };
            });

            // --- DOT EATING ---
            setDots(d => {
                if (d[pacman.y][pacman.x]) {
                    setScore(s => s + 10);
                    const newDots = d.map(r => [...r]);
                    newDots[pacman.y][pacman.x] = false;
                    return newDots;
                }
                return d;
            });
            
            // --- GHOST MOVEMENT (conditional based on speed ratio) ---
            if (tickCountRef.current % GHOST_SPEED_RATIO === 0) {
                setGhosts(gs => gs.map(g => {
                    const validMoves = [];
                    Object.values(DIRS).forEach(dir => {
                        const nx = g.x + dir.x;
                        const ny = g.y + dir.y;
                        if (dir.x === -g.dir.x && dir.y === -g.dir.y) return;
                        if (!isWall(nx, ny) && MAP[ny][nx] !== 3) validMoves.push(dir);
                    });
                    
                    let bestMove = g.dir;
                    if (validMoves.length > 0) {
                        let minDistance = Infinity;
                        validMoves.forEach(move => {
                            const distance = Math.hypot(g.x + move.x - pacman.x, g.y + move.y - pacman.y);
                            if (distance < minDistance) {
                                minDistance = distance;
                                bestMove = move;
                            }
                        });
                    } else {
                        bestMove = { x: -g.dir.x, y: -g.dir.y };
                    }
                    
                    let nx = g.x + bestMove.x;
                    let ny = g.y + bestMove.y;

                    if (nx === -1 && ny === 10) nx = COLS - 1;
                    if (nx === COLS && ny === 10) nx = 0;

                    return { ...g, x: nx, y: ny, dir: bestMove };
                }));
            }

            // ...existing code...
        };

        // This interval controls the base speed of the game
        gameLoopRef.current = setInterval(gameTick, 180);
        return () => clearInterval(gameLoopRef.current);
    }, [gameState, pacman.x, pacman.y]); // pacman coords are needed to update ghost AI target

    // --- GAME OVER / WIN CONDITIONS ---
    useEffect(() => {
        for (const ghost of ghosts) {
            if (ghost.x === pacman.x && ghost.y === pacman.y) {
                setGameState("lost");
                return;
            }
        }
        if (dots.flat().every(d => !d)) {
            setGameState("won");
        }
    }, [pacman, ghosts, dots]);

        // --- MOUTH ANIMATION LOOP (smooth chomping) ---
        useEffect(() => {
            const animLoop = setInterval(() => {
                animTickRef.current += 0.2; // speed of chomping
                const value = Math.abs(Math.sin(animTickRef.current));
                setMouthAngle(value * 40); // max angle (0–40 degrees)
            }, 60); // update every ~60ms (~16fps)

            return () => clearInterval(animLoop);
        }, []);

        // --- SVG RENDER FUNCTIONS ---
        const getPacmanPath = () => {
  const radius = tileSize / 2 - 2;
  const x = pacman.x * tileSize + tileSize / 2;
  const y = pacman.y * tileSize + tileSize / 2;

  const angle = pacman.dir.angle;
  const start = (angle - mouthAngle + 360) % 360;
  const end = (angle + mouthAngle + 360) % 360;
  const rad = (deg) => (deg * Math.PI) / 180;

  // Large arc flag: if the mouth is small, we want most of the circle drawn
  const largeArcFlag = mouthAngle > 180 ? 1 : 0;

  const x1 = x + radius * Math.cos(rad(start));
  const y1 = y + radius * Math.sin(rad(start));
  const x2 = x + radius * Math.cos(rad(end));
  const y2 = y + radius * Math.sin(rad(end));

  // Draw a "pizza slice": move to center, line to start, arc around, then back
  return `
    M ${x},${y}
    L ${x1},${y1}
    A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2}
    Z
  `;
};

    const ghostBodyPath = `M${tileSize*0.1},${tileSize*0.5} A${tileSize*0.4},${tileSize*0.4} 0 0,1 ${tileSize*0.9},${tileSize*0.5} V${tileSize*0.85} H${tileSize*0.7} L${tileSize*0.5},${tileSize*0.65} L${tileSize*0.3},${tileSize*0.85} H${tileSize*0.1} Z`;

    // --- MAIN RENDER ---
    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ maxWidth: COLS * tileSize }}>
                <h1 className={styles.title}>PAC-MAN</h1>
                <div className={styles.score}>SCORE: {score}</div>
            </div>

            <div className={styles.gameBoardContainer}>
                {gameState !== 'playing' && (
                    <div className={styles.overlay}>
                        <div className={styles.overlayMessage}>
                            {gameState === 'won' ? 'YOU WIN!' : 'GAME OVER'}
                        </div>
                        <button className={styles.resetButton} onClick={resetGame}>
                            Play Again
                        </button>
                    </div>
                )}
                <svg
                    className={styles.gameBoard}
                    width={COLS * tileSize}
                    height={ROWS * tileSize}
                >
                    <g>
                        {MAP.map((row, y) =>
                            row.map((cell, x) => {
                                if (cell === 1) {
                                    return (
                                        <rect key={`wall-${x}-${y}`}
                                            x={x * tileSize} y={y * tileSize}
                                            width={tileSize} height={tileSize}
                                            fill="#1010ff"
                                        />
                                    );
                                }
                                if (dots[y][x]) {
                                    return (
                                        <circle key={`dot-${x}-${y}`}
                                            cx={x * tileSize + tileSize / 2}
                                            cy={y * tileSize + tileSize / 2}
                                            r={cell === 4 ? tileSize * 0.25 : tileSize * 0.125}
                                            fill="#ffd700"
                                        />
                                    );
                                }
                                return null;
                            })
                        )}
                    </g>
                    <g>
                        {ghosts.map(g => (
                             <g key={g.id} transform={`translate(${g.x * tileSize}, ${g.y * tileSize})`}>
                                 <path d={ghostBodyPath} fill={g.color} />
                                 <g fill="white">
                                     <circle cx={tileSize*0.3 + g.dir.x * 2} cy={tileSize*0.4 + g.dir.y * 2} r={tileSize*0.12} />
                                     <circle cx={tileSize*0.7 + g.dir.x * 2} cy={tileSize*0.4 + g.dir.y * 2} r={tileSize*0.12} />
                                 </g>
                                 <g fill="black">
                                     <circle cx={tileSize*0.3 + g.dir.x * 3} cy={tileSize*0.4 + g.dir.y * 3} r={tileSize*0.06} />
                                     <circle cx={tileSize*0.7 + g.dir.x * 3} cy={tileSize*0.4 + g.dir.y * 3} r={tileSize*0.06} />
                                 </g>
                             </g>
                        ))}
                                                {/* Pac-Man body with black outline */}
                                                <path d={getPacmanPath()} fill="red" stroke="#222" strokeWidth={2} />
                                                {/* Pac-Man glossy highlight */}
                                                <ellipse
                                                    cx={pacman.x * tileSize + tileSize / 2 - tileSize * 0.18}
                                                    cy={pacman.y * tileSize + tileSize / 2 - tileSize * 0.18}
                                                    rx={tileSize * 0.13}
                                                    ry={tileSize * 0.07}
                                                    fill="green"
                                                    opacity={0.25}
                                                />
                                                {/* Pac-Man eye */}
                                                <circle
                                                    cx={(() => {
                                                        // Eye position slightly forward in direction of travel
                                                        const angle = pacman.dir.angle;
                                                        const rad = (deg) => (deg * Math.PI) / 180;
                                                        return pacman.x * tileSize + tileSize / 2 + Math.cos(rad(angle)) * tileSize * 0.18;
                                                    })()}
                                                    cy={(() => {
                                                        const angle = pacman.dir.angle;
                                                        const rad = (deg) => (deg * Math.PI) / 180;
                                                        return pacman.y * tileSize + tileSize / 2 - tileSize * 0.18 + Math.sin(rad(angle)) * tileSize * 0.09;
                                                    })()}
                                                    r={tileSize * 0.08}
                                                    fill="green"
                                                />
                    </g>
                </svg>
            </div>
            <div className={styles.instructions}>
                Use arrow keys to move
            </div>
        </div>
    );
}

export default function Page() {
    return <PacmanGame />;
}