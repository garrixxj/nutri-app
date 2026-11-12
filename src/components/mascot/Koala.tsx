import type { CSSProperties } from 'react'
import './koala.css'
import type { KoalaState } from './states.ts'

/**
 * Coach koala drawn as one inline SVG with named part groups (see DESIGN.md → Mascota).
 * Each arm is a rig (shoulder → elbow → hand) and a pose is a set of angles in koala.css,
 * so switching state rotates the arms instead of swapping drawings. Face parts are
 * variants shown per state. Only transform and opacity are animated.
 */

const W = 240
const H = 276

/** Rig pivots, in the left arm's own (unmirrored) coordinates. */
const SHOULDER = [84, 156] as const
const ELBOW = [84, 200] as const
const WRIST = [85, 246] as const
/** Center of the fist, where props are held. */
const GRIP = [85, 250] as const

const at = ([x, y]: readonly [number, number]): CSSProperties => ({ transformOrigin: `${x}px ${y}px` })

/** Closed fluffy circle: `n` outward bumps of height ~`amp` around radius `r`. */
function scallop(cx: number, cy: number, r: number, n: number, amp: number): string {
  const pt = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`
  const step = (2 * Math.PI) / n
  const start = -Math.PI / 2
  let d = `M${pt(start, r)}`
  for (let i = 0; i < n; i++) {
    const a = start + i * step
    d += `Q${pt(a + step / 2, r + amp * 2)} ${pt(a + step, r)}`
  }
  return `${d}Z`
}

/** Classes that make a variant visible only in the given states. */
const show = (...states: KoalaState[]) => `k-v ${states.map((s) => `s-${s}`).join(' ')}`

/** Mirrors its children onto the koala's left side (viewer's right). */
const MIRROR = `translate(${W} 0) scale(-1 1)`

function Ear() {
  return (
    <g className="k-ear">
      <path className="fur ln" d={scallop(70, 64, 29, 10, 3.2)} />
      <path className="fur-l" d={scallop(66, 60, 16, 7, 2.2)} />
    </g>
  )
}

/** One eye with its brow and lid, drawn on the viewer's left; the other side is mirrored. */
function EyeSide() {
  return (
    <g>
      {/* Eyes */}
      <g className={show('idle', 'celebrate')}>
        <path className="white ln-t" d="M87 99C90 93 101 92 106 97C102 103 91 104 87 99Z" />
        <circle className="ink" cx="98" cy="98.5" r="4.3" />
        <circle className="white" cx="99.6" cy="96.8" r="1.4" />
      </g>
      <g className={show('worried')}>
        <ellipse className="white ln-t" cx="96" cy="99" rx="7.5" ry="7.5" />
        <circle className="ink" cx="97" cy="100" r="4" />
        <circle className="white" cx="98.4" cy="98.4" r="1.3" />
      </g>
      <path className={`ln-f ${show('cheer')}`} d="M88 100Q96.5 91 105 100" />
      <path className={`ln-f ${show('eat', 'sleep')}`} d="M88 97Q96.5 104 105 97" />
      {/* Lids: hidden (scaleY 0) until a blink */}
      <g className="k-lid" style={at([96, 92])}>
        <path className="fur" d="M85 99C88 90 102 89 108 96C104 105 89 106 85 99Z" />
        <path className="ln-f" d="M87 99Q96.5 102 106 97" />
      </g>
      {/* Brows */}
      <path className={`ln-b ${show('idle', 'celebrate')}`} d="M86 85L106 92" />
      <path className={`ln-f ${show('cheer', 'eat')}`} d="M87 87Q96 82 105 87" />
      <path className={`ln-f ${show('sleep')}`} d="M87 89Q96 86.5 105 89" />
      <path className={`ln-b ${show('worried')}`} d="M87 89L105 83" />
    </g>
  )
}

function Head() {
  const head =
    'M120 46C152 46 174 66 175 96L181 103L173 108L178 117L169 119C160 138 142 148 120 148C98 148 80 138 71 119L62 117L67 108L59 103L65 96C66 66 88 46 120 46Z'
  return (
    <g className="k-head" style={at([120, 146])}>
      <path className="fur ln" d="M106 53L109 38L117 47L122 33L128 46L135 39L134 53Z" />
      <path className="fur" d={head} />
      <clipPath id="k-head-clip">
        <path d={head} />
      </clipPath>
      <g clipPath="url(#k-head-clip)">
        {/* Cintillo */}
        <path className="tank ln" d="M50 76C86 56 154 56 190 76L190 92C154 72 86 72 50 92Z" />
        {/* Chin */}
        <path className="fur-l" d="M102 122C98 146 142 146 138 122C132 131 108 131 102 122Z" />
      </g>
      <path className="ln" fill="none" d={head} />
      <g className="k-eyes">
        <EyeSide />
        <g transform={MIRROR}>
          <EyeSide />
        </g>
      </g>
      {/* Nose */}
      <path className="ink" d="M120 89C133 89 138 100 137 110C136 122 128 129 120 129C112 129 104 122 103 110C102 100 107 89 120 89Z" />
      <ellipse className="nose-hi" cx="113" cy="99" rx="3" ry="4.5" transform="rotate(20 113 99)" />
      {/* Mouth */}
      <g className="k-mouth">
        <path className={`ln-f ${show('idle')}`} d="M111 137Q121 142 130 133" />
        <path className={`ln-f ${show('cheer')}`} d="M109 134Q120 145 131 134" />
        <ellipse className={`ink ${show('eat')}`} cx="121" cy="137.5" rx="3.6" ry="3" />
        <g className={show('celebrate')}>
          <path className="ink ln-t" d="M108 133Q120 152 132 133Q120 137 108 133Z" />
          <path className="tongue" d="M113 142Q120 138 127 142Q120 148 113 142Z" />
        </g>
        <ellipse className={`ink k-yawn ${show('sleep')}`} style={at([120, 134])} cx="120" cy="139" rx="5.5" ry="7.5" />
        <path className={`ln-f ${show('worried')}`} d="M112 139Q120 133 128 139" />
      </g>
    </g>
  )
}

function Body() {
  return (
    <g className="k-body">
      {/* Torso, chest and belly fur */}
      <path className="fur ln" d="M72 160C74 146 94 139 120 139C146 139 166 146 168 160C166 182 158 200 154 216C142 228 98 228 86 216C82 200 74 182 72 160Z" />
      <path className="fur-l" d="M104 143C108 162 132 162 136 143Z" />
      <path className="fur-l" d="M98 212C104 224 136 224 142 212C136 216 104 216 98 212Z" />
      {/* Polera */}
      <g className="k-tank">
        <path className="tank ln" d="M91 142L104 142C106 158 113 164 120 164C127 164 134 158 136 142L149 142C151 157 158 165 164 170C158 184 155 196 154 211C139 218 101 218 86 211C85 196 82 184 76 170C82 165 89 157 91 142Z" />
        <path className="ln-t" fill="none" d="M100 184C108 191 115 189 120 182C125 189 132 191 140 184" />
        <path className="ln-t" fill="none" d="M120 186L120 200" />
      </g>
    </g>
  )
}

function Legs() {
  return (
    <g className="k-legs">
      <path className="fur ln" d="M89 208C87 228 89 244 91 255L116 255C117 242 118 226 118 210Z" />
      <path className="fur ln" d="M122 210C122 226 123 242 124 255L149 255C151 244 153 228 151 208Z" />
      <ellipse className="fur ln" cx="101" cy="260" rx="19" ry="8.5" />
      <ellipse className="fur ln" cx="139" cy="260" rx="19" ry="8.5" />
      <path className="ln-t" fill="none" d="M90 262L90 266M97 263L97 267M143 263L143 267M150 262L150 266" />
    </g>
  )
}

interface HandStates {
  fist: KoalaState[]
  thumb?: KoalaState[]
  open?: KoalaState[]
  cup?: KoalaState[]
}

/** A rig arm drawn as the viewer's left arm hanging down; `side="r"` mirrors it. */
function Arm({ side, hands }: { side: 'l' | 'r'; hands: HandStates }) {
  const arm = (
    <g className="k-rig k-sh" style={at(SHOULDER)}>
      <g className="k-m" style={at(SHOULDER)}>
        <path className="fur ln" d="M86 144C72 142 61 152 61 170C61 186 67 199 76 206C84 211 96 207 98 198C102 184 102 166 98 154C96 148 92 144 86 144Z" />
        <path className="ln-t" fill="none" d="M66 163C74 168 86 168 96 162" />
        <ellipse className="shine" cx="70" cy="180" rx="2.6" ry="6" />
        <g className="k-rig k-el" style={at(ELBOW)}>
          <g className="k-m" style={at(ELBOW)}>
            <path className="fur ln" d="M71 198C69 213 73 229 76 242L94 242C97 229 101 213 99 198C94 191 76 191 71 198Z" />
            <g className="k-rig k-hd" style={at(WRIST)}>
              <g className="k-m" style={at(WRIST)}>
                {hands.cup && (
                  <g className={`k-prop ${show(...hands.cup)}`} style={at(GRIP)}>
                    <g transform={`translate(${GRIP[0]} ${GRIP[1]})`}>
                      <path className="cup ln-t" d="M-12 -22L12 -22L9 17L-9 17Z" />
                      <path className="k-shake shake" style={at([0, 15])} d="M-10.4 -8L10.4 -8L9.2 15L-9.2 15Z" />
                      <path className="ink" d="M-14 -27L14 -27L14 -21L-14 -21Z" />
                      <path className="straw" d="M5 -27L11 -36L33 -14" />
                    </g>
                  </g>
                )}
                <path className={`fur ln ${show(...hands.fist)}`} d="M72 242C70 254 76 260 85 260C94 260 100 254 98 242C96 236 74 236 72 242Z" />
                <path className={`ln-t ${show(...hands.fist)}`} fill="none" d="M78 254L79 259M85 255L85 260M92 254L91 259" />
                {hands.thumb && (
                  <g className={show(...hands.thumb)}>
                    <path className="fur ln" d="M72 241C70 253 76 259 85 259C94 259 100 253 98 241C96 235 74 235 72 241Z" />
                    <path className="fur ln" d="M76 252C72 260 70 270 76 272C82 274 85 264 86 256Z" />
                    <path className="ln-t" fill="none" d="M88 246L95 246M88 251L95 251" />
                  </g>
                )}
                {hands.open && (
                  <g className={show(...hands.open)}>
                    <path className="fur ln" d="M72 240C68 252 70 266 76 268C78 270 81 269 82 266C83 270 87 270 88 266C90 269 93 268 94 264C97 265 99 262 99 258C100 250 99 244 97 240Z" />
                  </g>
                )}
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  )
  return (
    <g className={`k-arm k-arm-${side}`} transform={side === 'r' ? MIRROR : undefined}>
      {arm}
    </g>
  )
}

function Sparkle({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className="k-spark white ln-t"
        style={{ animationDelay: `${delay}ms` }}
        d="M0 -9C1 -3 3 -1 9 0C3 1 1 3 0 9C-1 3 -3 1 -9 0C-3 -1 -1 -3 0 -9Z"
      />
    </g>
  )
}

export function Koala({
  state,
  size = 120,
  still = false,
  className = '',
}: {
  state: KoalaState
  /** Rendered height in px. */
  size?: number
  /** Static pose, as with prefers-reduced-motion. */
  still?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={(size * W) / H}
      height={size}
      className={`koala ${still ? 'k-still' : ''} ${className}`}
      data-state={state}
      aria-hidden="true"
      focusable="false"
    >
      <g className="k-all" style={at([120, 270])}>
        <Legs />
        <g className="k-upper" style={at([120, 220])}>
          <Ear />
          <g transform={MIRROR}>
            <Ear />
          </g>
          <Body />
          <Head />
          <Arm side="l" hands={{ fist: ['idle', 'celebrate'], thumb: ['cheer'], open: ['sleep', 'worried'], cup: ['eat'] }} />
          <Arm
            side="r"
            hands={{ fist: ['idle', 'cheer', 'eat', 'celebrate', 'sleep', 'worried'] }}
          />
          {/* Towel over the right shoulder */}
          <g className={show('sleep')}>
            <path className="white ln" d="M140 140C146 133 162 133 168 142C170 162 168 184 164 206L146 206C146 186 144 160 140 140Z" />
            <path className="ln-t" fill="none" d="M146 196L165 196M146 200L164 200" />
          </g>
        </g>
      </g>
      <g className={`k-fx ${show('celebrate')}`}>
        <Sparkle x={20} y={86} s={1} delay={0} />
        <Sparkle x={44} y={56} s={0.7} delay={300} />
        <Sparkle x={220} y={86} s={1} delay={150} />
        <Sparkle x={196} y={56} s={0.7} delay={450} />
      </g>
      <g className={`k-fx ${show('sleep')}`}>
        <path className="k-z ln-f" d="M38 70L48 70L38 80L48 80" />
        <path className="k-z ln-t" style={{ animationDelay: '700ms' }} d="M26 52L33 52L26 59L33 59" />
        <path className="k-z ln-t" style={{ animationDelay: '1400ms' }} d="M36 36L41 36L36 41L41 41" />
      </g>
    </svg>
  )
}
