/**
 * Rayo índigo — shader WebGL de fondo, portado de irbximena.com/v2 (prototipo/js/ray.js).
 * Un haz de luz con dispersión cromática: cuanto más "amor" (scroll, avance), más se abre en los 8 colores del logo IRB®.
 * Sigue el cursor con inercia. Resolución adaptativa: mide los fps reales y baja la resolución (el fondo es difuso
 * por naturaleza) si el equipo no alcanza. Sin WebGL, queda un degradado estático.
 */

export const SPECTRUM = ['#7A6CF0', '#E2574E', '#FF4A3D', '#FFD141', '#8BD336', '#3D8BFF', '#A35BD9', '#F196CE'];
const PAL = SPECTRUM.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision mediump float;
uniform vec2 uRes;uniform float uTime,uLove,uBeam,uFlash,uDim;uniform vec2 uMouse;uniform vec3 uPal[8];
float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
const mat2 R=mat2(.8,.6,-.6,.8);
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=R*p*2.02;a*=.5;}return v;}
float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*n(p);p=R*p*2.02;a*=.5;}return v;}
vec3 pal(float t){t=fract(t)*8.;float f=floor(t);int i0=int(f);int i1=int(mod(f+1.,8.));vec3 a=uPal[0],b=uPal[0];
  for(int i=0;i<8;i++){if(i==i0)a=uPal[i];if(i==i1)b=uPal[i];}
  return mix(a,b,smoothstep(0.,1.,t-f));}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float t=uTime;
  vec2 q=p*1.35+vec2(t*.025,-t*.018);
  q+=.35*vec2(sin(q.y*2.1+t*.11),cos(q.x*1.9-t*.09));
  float w1=fbm(q);
  float w2=fbm3(q*2.3-vec2(w1*1.2,t*.02));
  vec3 indigo=vec3(.20,.14,.86);
  vec3 col=vec3(.02,.016,.08)+indigo*pow(w1,2.6)*.75+vec3(.32,.20,.72)*(w2*w2*w2*w2)*.5;
  if(uLove>.003){col+=pal(w2*.9+p.x*.18+p.y*.12+t*.015)*pow(w1,2.2)*.95*uLove;}
  float tilt=(uMouse.x-.5)*.55;
  float bx=(uMouse.x-.5)*.25*uRes.x/uRes.y+tilt*p.y+sin(p.y*2.2+t*.6)*.025;
  float d=p.x-bx;
  float w=.035+.05*uLove+.6*uFlash;
  if(abs(d)<w*3.2+.08){
    float disp=(.006+.05*uLove)*(1.2-p.y);
    float tex=.55+.65*fbm3(vec2(d*7.,p.y*1.4-t*.9));
    float ww=w*w,wg=w*w*.81;
    vec3 b=vec3(exp(-(d+disp)*(d+disp)/ww),exp(-d*d/wg),exp(-(d-disp)*(d-disp)/ww))*tex;
    vec3 tint=mix(vec3(.62,.55,1.25),vec3(1.1,1.05,1.2),uLove*.6);
    col+=b*tint*uBeam*(1.15+uFlash*2.);
    float core=exp(-d*d/(.0016+.4*uFlash))*uBeam;
    col+=vec3(.9,.9,1.)*core*.55;
  }
  vec2 m=vec2((uMouse.x-.5)*uRes.x/uRes.y,(uMouse.y-.5));
  col+=indigo*.25*exp(-length(p-m)*3.5);
  vec2 v=uv-.5;float vig=pow(dot(v,v)*1.5625,1.1);
  col*=1.-.55*vig;
  col=mix(col,col*.62+vec3(.008,.006,.03),uDim);
  gl_FragColor=vec4(col,1.);
}`;

export type RayState = { love: number; beam: number; flash: number; dim: number; mx: number; my: number };

export function createRay(canvas: HTMLCanvasElement, coarse: boolean) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (t: number, s: string) => {
    const o = gl.createShader(t)!;
    gl.shaderSource(o, s);
    gl.compileShader(o);
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uRes', 'uTime', 'uLove', 'uBeam', 'uFlash', 'uDim', 'uMouse', 'uPal'].map((k) => [k, gl.getUniformLocation(pr, k)]));
  gl.uniform3fv(U.uPal!, new Float32Array(PAL.flat()));

  // el fondo es difuso: se dibuja a una fracción de la resolución y el navegador lo escala
  const LEVELS = [0.5, 0.4, 0.32, 0.25];
  let lvl = coarse || innerWidth * innerHeight > 2.6e6 ? 1 : 0;
  let scale = LEVELS[lvl]!;
  const resize = () => {
    canvas.width = Math.max(2, Math.round(innerWidth * scale));
    canvas.height = Math.max(2, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  let acc = 0,
    frames = 0,
    last = 0;
  return {
    resize,
    draw(now: number, t: number, s: RayState) {
      if (last) {
        acc += now - last;
        frames++;
      }
      last = now;
      // cada 45 cuadros: si va lento (>19 ms por cuadro), baja un nivel de resolución; nunca apaga el efecto
      if (frames === 45) {
        if (acc / frames > 19 && lvl < LEVELS.length - 1) {
          scale = LEVELS[++lvl]!;
          resize();
        }
        acc = 0;
        frames = 0;
      }
      gl.uniform2f(U.uRes!, canvas.width, canvas.height);
      gl.uniform1f(U.uTime!, t);
      gl.uniform1f(U.uLove!, s.love);
      gl.uniform1f(U.uBeam!, s.beam);
      gl.uniform1f(U.uFlash!, s.flash);
      gl.uniform1f(U.uDim!, s.dim);
      gl.uniform2f(U.uMouse!, s.mx, s.my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resetClock() {
      last = 0;
    },
    lose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
