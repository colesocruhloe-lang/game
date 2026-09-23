/* Urban Clash — Vice District
   Standalone WebGL open-world game. No external libraries.
   Original code and assets. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const canvas=$('game');
const isTouch=('ontouchstart' in window)||(navigator.maxTouchPoints>0&&window.matchMedia&&matchMedia('(pointer:coarse)').matches);

let gl=null;
try{gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');}catch(e){}
function fatal(msg){const s=$('start');if(s)s.style.display='none';const e=$('error');e.style.display='flex';e.innerHTML='<div class="errbox"><b>3D не запустился</b>'+msg+'</div>';}
if(!gl){fatal('Браузер не дал странице доступ к WebGL. Откройте сайт в актуальном Chrome, Edge, Firefox или Safari и включите аппаратное ускорение.');return;}
const U32=!!gl.getExtension('OES_element_index_uint');
const MAXV=U32?2000000:64000;

/* ================= SHADERS ================= */
const VS=`attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute float e;
uniform mat4 vp;uniform mat4 model;
varying vec3 vc;varying vec3 vn;varying vec3 vw;varying float ve;
void main(){vec4 w=model*vec4(p,1.0);vw=w.xyz;vn=mat3(model[0].xyz,model[1].xyz,model[2].xyz)*n;vc=c;ve=e;gl_Position=vp*w;}`;
const FS=`precision mediump float;
varying vec3 vc;varying vec3 vn;varying vec3 vw;varying float ve;
uniform vec3 sunDir;uniform vec3 sunCol;uniform vec3 ambSky;uniform vec3 ambGnd;uniform vec3 fogCol;uniform vec3 camPos;
uniform float fogD;uniform float glow;uniform float uA;
void main(){
 vec3 N=normalize(vn);vec3 V=normalize(camPos-vw);
 float shiny=max(-ve,0.0);float em=max(ve,0.0);
 float d=max(dot(N,sunDir),0.0);
 vec3 amb=mix(ambGnd,ambSky,N.y*0.5+0.5);
 vec3 H=normalize(sunDir+V);
 float sp=pow(max(dot(N,H),0.0),mix(24.0,160.0,shiny))*(0.1+shiny*2.2)*smoothstep(0.0,0.15,d);
 vec3 col=vc*(amb+sunCol*d)+sunCol*sp;
 float fr=pow(1.0-max(dot(N,V),0.0),3.0);
 col+=fogCol*shiny*fr*0.45;
 if(em>0.9){col=vc*1.35;}else{col=mix(col,vec3(1.0,0.84,0.55),em*glow);}
 float dist=length(vw-camPos);
 float f=clamp(1.0-exp(-dist*fogD),0.0,1.0);
 f=f*f*(em>0.9?0.5:1.0);
 col=mix(col,fogCol,f);
 gl_FragColor=vec4(col,uA);
}`;
const SVS=`attribute vec2 q;varying vec2 uv;void main(){uv=q;gl_Position=vec4(q,0.9999,1.0);}`;
const SFS=`precision mediump float;varying vec2 uv;
uniform vec3 top;uniform vec3 hor;uniform vec3 sunCol;uniform vec3 sunP;uniform float hy;uniform float asp;uniform float night;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 float t=clamp((uv.y-hy)/1.3,0.0,1.0);
 vec3 col=mix(hor,top,pow(t,0.55));
 vec2 dd=(uv-sunP.xy)*vec2(asp,1.0);float d=length(dd);
 col+=sunCol*(smoothstep(0.075,0.06,d)*1.1+exp(-d*4.5)*0.4)*sunP.z;
 float s=step(0.9975,h(floor(gl_FragCoord.xy/2.0)))*night*smoothstep(0.03,0.3,t);
 col+=vec3(s*0.9);
 gl_FragColor=vec4(col,1.0);
}`;
function prog(v,f,attrs){const p=gl.createProgram();attrs.forEach((n,i)=>gl.bindAttribLocation(p,i,n));
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x};
 gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
let PR,SK;
try{PR=prog(VS,FS,['p','n','c','e']);SK=prog(SVS,SFS,['q']);}catch(err){fatal('Ошибка шейдера: '+err.message);return;}
const UL={};for(const n of ['vp','model','sunDir','sunCol','ambSky','ambGnd','fogCol','camPos','fogD','glow','uA'])UL[n]=gl.getUniformLocation(PR,n);
const SU={};for(const n of ['top','hor','sunCol','sunP','hy','asp','night'])SU[n]=gl.getUniformLocation(SK,n);
const skyBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,skyBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);

/* ================= MATH ================= */
const I=()=>{const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m};
const ID=I();
function M(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function MM(){let m=arguments[0];for(let i=1;i<arguments.length;i++)m=M(m,arguments[i]);return m}
function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m}
function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m}
function RY(a){const m=I(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
function RX(a){const m=I(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m}
function persp(f,a,n,far){const q=1/Math.tan(f/2),nf=1/(n-far),m=new Float32Array(16);m[0]=q/a;m[5]=q;m[10]=(far+n)*nf;m[11]=-1;m[14]=2*far*n*nf;return m}
function look(e,t){let zx=e[0]-t[0],zy=e[1]-t[1],zz=e[2]-t[2],l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
 let xx=zz,xz=-zx;l=Math.hypot(xx,xz)||1;xx/=l;xz/=l;const xy=0;
 const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
 const m=new Float32Array(16);m[0]=xx;m[4]=xy;m[8]=xz;m[1]=yx;m[5]=yy;m[9]=yz;m[2]=zx;m[6]=zy;m[10]=zz;
 m[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);m[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);m[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);m[15]=1;return m}
function proj(m,x,y,z){const w=m[3]*x+m[7]*y+m[11]*z+m[15];return[(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,w]}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const lerpC=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t)};
const angD=(a,b)=>{let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d};
const turnTo=(a,b,k)=>a+angD(b,a)*Math.min(1,k);
let seed=20260923;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const R=Math.random;const pick=(a,r=R)=>a[Math.floor(r()*a.length)%a.length];

/* ================= GEOMETRY ================= */
const colCache={};
function col(h){if(colCache[h])return colCache[h];const s=h.replace('#','');return colCache[h]=[parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255]}
const CQ=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
// faces: 0 back(-z) 1 front(+z) 2 left(-x) 3 right(+x) 4 bottom 5 top  -> mask bits
const CF=[[0,3,2,1,0,0,-1],[4,5,6,7,0,0,1],[0,4,7,3,-1,0,0],[1,2,6,5,1,0,0],[0,1,5,4,0,-1,0],[3,7,6,2,0,1,0]];
class Geo{
 constructor(){this.bs=[];this.nb()}
 nb(){this.c={p:[],n:[],c:[],e:[],i:[],v:0};this.bs.push(this.c)}
 box(m,sx,sy,sz,hex,e,mask){e=e||0;if(mask===undefined)mask=63;if(this.c.v>MAXV-30)this.nb();const B=this.c,cc=col(hex);
  for(let f=0;f<6;f++){if(!((mask>>f)&1))continue;const F=CF[f],base=B.v;
   const nx=m[0]*F[4]+m[4]*F[5]+m[8]*F[6],ny=m[1]*F[4]+m[5]*F[5]+m[9]*F[6],nz=m[2]*F[4]+m[6]*F[5]+m[10]*F[6];
   for(let k=0;k<4;k++){const q=CQ[F[k]],x=q[0]*sx,y=q[1]*sy,z=q[2]*sz;
    B.p.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);
    B.n.push(nx,ny,nz);B.c.push(cc[0],cc[1],cc[2]);B.e.push(e);}
   B.i.push(base,base+1,base+2,base,base+2,base+3);B.v+=4;}}
 b(x,y,z,sx,sy,sz,hex,e,ry,mask){this.box(ry?M(T(x,y,z),RY(ry)):T(x,y,z),sx,sy,sz,hex,e,mask)}
 build(){return this.bs.filter(B=>B.v).map(upload)}
}
function upload(B){const o={};
 for(const [k,v] of [['p',B.p],['n',B.n],['c',B.c],['e',B.e]]){o[k]=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o[k]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW)}
 o.i=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,o.i);const big=B.v>65535;
 gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,big?new Uint32Array(B.i):new Uint16Array(B.i),gl.STATIC_DRAW);
 o.type=big?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;o.count=B.i.length;return o}
const mk=fn=>{const g=new Geo();fn(g);return g.build()};
function bindA(b,loc,n){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,n,gl.FLOAT,false,0,0)}
function draw(mesh,model){gl.uniformMatrix4fv(UL.model,false,model);
 for(const o of mesh){bindA(o.p,0,3);bindA(o.n,1,3);bindA(o.c,2,3);bindA(o.e,3,1);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,o.i);gl.drawElements(gl.TRIANGLES,o.count,o.type,0)}}
const unitCache={};const unitMesh=(h,e)=>{const k=h+'|'+(e||0);return unitCache[k]||(unitCache[k]=mk(g=>g.b(0,0,0,1,1,1,h,e||0)))};

/* ================= WORLD LAYOUT ================= */
const XR=[],ZR=[];for(let i=0;i<9;i++)XR.push(-180+i*40);for(let i=0;i<8;i++)ZR.push(-140+i*40);
const LX0=-200,LX1=160,LZ0=-160,LZ1=160,SX0=-216,SX1=194,SZ0=-176,SZ1=176,RW=6,SW=0.18;
const MX0=-240,MZ0=-200;
const blocks=[],solids=[],parkSpots=[];
const PASTEL=['#f2b8c6','#9fd8d0','#f4e3c3','#c9b8e8','#f6c89f','#eef2f2','#a9d2ec','#f7d7a8','#ffc1d9','#b8ecd6'];
const TRIM=['#e46a8f','#2aa39a','#d69b52','#7d64b6','#ffffff','#3c86b5','#f08a5d'];
const CITY=['#b9a58f','#c98b6f','#9aa3a8','#d8cdb8','#8c9aa6','#c7b299','#a68f7a'];
const NEON=['#ff3fa4','#33e6ff','#7dff6a','#ffb13b','#b46bff'];

function palm(G,x,z,h,y0){y0=y0||0;const la=rnd()*6.283,lean=.6+rnd()*1.3,lx=Math.sin(la),lz=Math.cos(la),n=8;let tx=x,tz=z;
 for(let k=0;k<n;k++){const f=k/n,ox=lx*lean*f*f*2,oz=lz*lean*f*f*2,w=.24-.1*f;G.b(x+ox,y0+h*(k+.5)/n,z+oz,w,h/n/2+.03,w,k%2?'#8b6a4b':'#7a5c40');tx=x+ox;tz=z+oz}
 const ty=y0+h;G.b(tx,ty,tz,.3,.25,.3,'#5c7a2e');
 for(let k=0;k<3;k++)G.b(tx+Math.cos(k*2.1)*.26,ty-.28,tz+Math.sin(k*2.1)*.26,.14,.14,.14,'#6b4a2a');
 const nf=8;for(let k=0;k<nf;k++){const yaw=k/nf*6.283+rnd()*.3,base=M(T(tx,ty+.1,tz),RY(yaw)),c1=k%2?'#3f8a3a':'#4d9c3f';
  G.box(MM(base,RX(.22),T(0,0,1.4)),.42,.04,1.4,c1);
  G.box(MM(base,RX(.22),T(0,0,2.8),RX(.6),T(0,0,1.1)),.34,.04,1.1,c1)}}

function winRow(G,x,y,z,w,d,style,glass){const gw=style==='glass';
 for(let side=0;side<4;side++){const span=side<2?w:d,n=Math.max(1,Math.floor((span-1.2)/(gw?3.2:2.6))),seg=(span-1.2)/n;
  for(let k=0;k<n;k++){const o=-span/2+.6+seg*(k+.5),lit=rnd()<.42?.85:0,hw=seg/2-(gw?.1:.35),hh=gw?1.35:1.0;
   if(side===0)G.b(x+o,y,z+d/2+.02,hw,hh,.01,glass,lit,0,2);
   else if(side===1)G.b(x+o,y,z-d/2-.02,hw,hh,.01,glass,lit,0,1);
   else if(side===2)G.b(x+w/2+.02,y,z+o,.01,hh,hw,glass,lit,0,8);
   else G.b(x-w/2-.02,y,z+o,.01,hh,hw,glass,lit,0,4)}}}

function building(G,x,z,w,d,h,body,trim,style,yb){const base=yb===undefined;if(base)yb=SW;
 G.b(x,yb+h/2,z,w/2,h/2,d/2,body);
 if(base)solids.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,h:yb+h,bld:1});
 if(base&&style==='deco')G.b(x,yb+.7,z,w/2+.1,.7,d/2+.1,trim,0,0,15);
 G.b(x,yb+h-.3,z,w/2+.14,.3,d/2+.14,trim);
 if(style==='deco'&&h>11){G.b(x,yb+h*.52,z+d/2+.09,.45,h*.4,.09,trim);G.b(x,yb+h*.52,z-d/2-.09,.45,h*.4,.09,trim)}
 const fh=style==='glass'?3.3:3.5,floors=Math.floor((h-1.2)/fh),glass=style==='glass'?'#1e3040':'#2a3c4c';
 for(let f=0;f<floors;f++)winRow(G,x,yb+f*fh+fh*.55,z,w,d,style,glass);
 if(style==='deco'&&rnd()<.6)G.b(x+(rnd()-.5)*w*.4,yb+h+.6,z+(rnd()-.5)*d*.4,1.2,.6,.9,'#9a9fa3');
 if(style==='deco'&&rnd()<.35){const wx=x+(rnd()-.5)*w*.4,wz=z+(rnd()-.5)*d*.4;for(const a of[-1,1])for(const c of[-1,1])G.b(wx+a*.6,yb+h+1,wz+c*.6,.07,1,.07,'#5a4a3a');G.b(wx,yb+h+2.6,wz,.9,.8,.9,'#8a6b4f')}}

function park(G,bx,bz,plaza){
 G.b(bx,SW+.02,bz,12.8,.02,12.8,plaza?'#d6c7a4':'#5a9446',0,0,63);
 if(plaza){for(let a=-2;a<=2;a++)for(let c=-2;c<=2;c++)if((a+c)%2===0)G.b(bx+a*4.6,SW+.045,bz+c*4.6,1.6,.005,1.6,'#e7a3b5',0,0,32)}
 else{G.b(bx,SW+.045,bz,12.8,.005,1.1,'#d9cba6',0,0,32);G.b(bx,SW+.045,bz,1.1,.005,12.8,'#d9cba6',0,0,32)}
 G.b(bx,SW+.35,bz,3.2,.35,3.2,'#e6e0d4');G.b(bx,SW+.72,bz,2.85,.02,2.85,'#3fb6d6',-1,0,32);
 G.b(bx,SW+1.6,bz,.35,1.2,.35,'#e6e0d4');G.b(bx,SW+2.9,bz,1,.12,1,'#e6e0d4');G.b(bx,SW+3.05,bz,.7,.04,.7,'#6fd6f0',-1,0,32);
 solids.push({x0:bx-3.2,x1:bx+3.2,z0:bz-3.2,z1:bz+3.2,h:SW+.7});
 const n=plaza?8:10;for(let k=0;k<n;k++){const a=k/n*6.283+rnd()*.3,r=plaza?9.8:6+rnd()*5.5;palm(G,bx+Math.cos(a)*r,bz+Math.sin(a)*r,6+rnd()*4,SW+.04)}
 for(const [ox,oz,ry] of [[6,-2.2,0],[-6,2.2,0],[2.2,6,Math.PI/2],[-2.2,-6,Math.PI/2]]){G.b(bx+ox,SW+.5,bz+oz,1.1,.06,.3,'#8a5a3a',0,ry);G.b(bx+ox,SW+.25,bz+oz,.9,.25,.2,'#3a3f45',0,ry)}}

function parking(G,bx,bz){G.b(bx,SW+.01,bz,12.8,.01,12.8,'#33373b',0,0,32);
 for(let k=-4;k<=4;k++){G.b(bx+k*2.8,SW+.025,bz-7,.06,.005,2.6,'#e5e5e5',0,0,32);G.b(bx+k*2.8,SW+.025,bz+7,.06,.005,2.6,'#e5e5e5',0,0,32)}
 for(let k=-4;k<4;k++){if(rnd()<.55)parkSpots.push({x:bx+k*2.8+1.4,z:bz-7,yaw:rnd()<.5?0:Math.PI});if(rnd()<.55)parkSpots.push({x:bx+k*2.8+1.4,z:bz+7,yaw:rnd()<.5?0:Math.PI})}
 G.b(bx+11,SW+1.2,bz,1.2,1.2,1.5,'#e9e3d6');G.b(bx+11,SW+2.5,bz,1.5,.1,1.8,'#e46a8f');solids.push({x0:bx+9.8,x1:bx+12.2,z0:bz-1.5,z1:bz+1.5,h:SW+2.4})}

function mid(G,bx,bz){const r=rnd(),pal=bx>60?PASTEL:(rnd()<.6?PASTEL:CITY);
 if(r<.35)building(G,bx,bz,22,22,10+rnd()*16,pick(pal,rnd),pick(TRIM,rnd),'deco');
 else if(r<.7){for(const s of[-1,1])building(G,bx+s*5.8,bz,10,22,8+rnd()*18,pick(pal,rnd),pick(TRIM,rnd),'deco')}
 else{for(const sx of[-1,1])for(const sz of[-1,1])building(G,bx+sx*5.8,bz+sz*5.8,10,10,7+rnd()*14,pick(pal,rnd),pick(TRIM,rnd),'deco')}}

function tower(G,bx,bz){const h=34+rnd()*46,w=18+rnd()*4,bc=pick(['#6d8fae','#7fa3b8','#5f7f99','#8aa0b0','#9db4c4'],rnd);
 building(G,bx,bz,w,w,h,bc,'#dfe7ee','glass');
 const h2=8+rnd()*16,w2=w*.62;building(G,bx,bz,w2,w2,h2,bc,'#dfe7ee','glass',SW+h);
 const top=SW+h+h2;G.b(bx,top+4,bz,.12,4,.12,'#c8ccd0');G.b(bx,top+8.2,bz,.28,.28,.28,'#ff3040',1);
 const nc=pick(NEON,rnd);for(const s of[-1,1]){G.b(bx,SW+h-.9,bz+s*(w/2+.06),w/2,.12,.04,nc,1);G.b(bx+s*(w/2+.06),SW+h-.9,bz,.04,.12,w/2,nc,1)}}

function hotel(G,bx,bz){const n=rnd()<.5?1:2;
 for(let k=0;k<n;k++){const d=n===1?22:10.5,z=n===1?bz:bz+(k?5.75:-5.75),h=12+rnd()*14,body=pick(PASTEL,rnd),trim=pick(TRIM,rnd),neon=pick(NEON,rnd),top=SW+h;
  building(G,bx,z,20,d,h,body,trim,'deco');
  G.b(bx,top+.05,z+d/2+.16,10.1,.1,.05,neon,1);G.b(bx,top+.05,z-d/2-.16,10.1,.1,.05,neon,1);G.b(bx+10.16,top+.05,z,.05,.1,d/2+.1,neon,1);G.b(bx-10.16,top+.05,z,.05,.1,d/2+.1,neon,1);
  G.b(bx+10.45,SW+h*.55,z,.3,h*.3,.8,'#1a1a22');G.b(bx+10.77,SW+h*.55,z,.03,h*.28,.6,neon,1);
  G.b(bx+2,top+2.2,z,1.2,2.2,Math.min(3,d/2-1),body);G.b(bx+2,top+4.5,z,.9,.12,.9,neon,1);
  G.b(bx+10.8,SW+3,z,.8,.08,d/2-1.5,trim)}}

function lamp(G,x,z,dx,dz){G.b(x,SW+3.1,z,.09,3.1,.09,'#3b4148');G.b(x+dx*.8,SW+6.15,z+dz*.8,dx?.85:.06,.06,dz?.85:.06,'#3b4148');G.b(x+dx*1.55,SW+6.05,z+dz*1.55,dx?.35:.2,.07,dz?.35:.2,'#fff0c4',1)}

function buildWorld(){
 const G=new Geo();
 G.b(0,-.6,0,3000,.3,3000,'#1a6b8e',-1,0,32);
 G.b((SX0+SX1)/2,-.2,(SZ0+SZ1)/2,(SX1-SX0)/2,.15,(SZ1-SZ0)/2,'#e4cf98');
 G.b((LX0+LX1)/2,-.25,0,(LX1-LX0)/2,.25,(LZ1-LZ0)/2,'#9b968d');
 for(const x of XR)G.b(x,.01,0,RW,.01,(LZ1-LZ0)/2,'#2d3136',0,0,32);
 for(const z of ZR)G.b((LX0+LX1)/2,.014,z,(LX1-LX0)/2,.014,RW,'#2d3136',0,0,32);
 for(const x of XR)for(const z of ZR)G.b(x,.018,z,RW,.018,RW,'#2f3338',0,0,32);
 const segs=(lines,lo,hi)=>{const s=[];let a=lo;for(const L of lines){if(L-RW>a)s.push([a,L-RW]);a=L+RW}if(hi>a)s.push([a,hi]);return s};
 for(const x of XR)for(const [a,b] of segs(ZR,LZ0,LZ1)){G.b(x+RW-.45,.042,(a+b)/2,.08,.004,(b-a)/2,'#dcdcdc',0,0,32);G.b(x-RW+.45,.042,(a+b)/2,.08,.004,(b-a)/2,'#dcdcdc',0,0,32);for(let z=a+2;z<b-3;z+=6)G.b(x,.042,z+1.3,.1,.004,1.3,'#e2b53a',0,0,32)}
 for(const z of ZR)for(const [a,b] of segs(XR,LX0,LX1)){G.b((a+b)/2,.042,z+RW-.45,(b-a)/2,.004,.08,'#dcdcdc',0,0,32);G.b((a+b)/2,.042,z-RW+.45,(b-a)/2,.004,.08,'#dcdcdc',0,0,32);for(let x=a+2;x<b-3;x+=6)G.b(x+1.3,.042,z,1.3,.004,.1,'#e2b53a',0,0,32)}
 for(const x of XR)for(const z of ZR)for(const sg of[-1,1])for(let s=-4.6;s<=4.7;s+=1.3){G.b(x+s,.044,z+sg*(RW+1.3),.38,.004,1.1,'#e8e8e8',0,0,32);G.b(x+sg*(RW+1.3),.044,z+s,1.1,.004,.38,'#e8e8e8',0,0,32)}
 for(let i=0;i<8;i++)for(let j=0;j<7;j++){const bx=-160+40*i,bz=-120+40*j;
  G.b(bx,SW/2,bz,14,SW/2,14,'#aaa59c');
  let type;if(bx===0&&bz===0)type='plaza';else if(bx===120)type='hotel';else if(Math.abs(bx)<=40&&Math.abs(bz)<=40)type='tower';else{const r=rnd();type=r<.14?'park':r<.23?'parking':'mid'}
  blocks.push({bx,bz,type});
  if(type==='plaza'||type==='park')park(G,bx,bz,type==='plaza');else if(type==='parking')parking(G,bx,bz);else if(type==='tower')tower(G,bx,bz);else if(type==='hotel')hotel(G,bx,bz);else mid(G,bx,bz)}
 for(const x of XR)for(const s of[-1,1]){const lx=x+s*(RW+.7);if(lx<LX0+1||lx>LX1-1)continue;for(let z=LZ0+10;z<LZ1-5;z+=22){if(ZR.some(zr=>Math.abs(z-zr)<10))continue;lamp(G,lx,z,-s,0)}}
 for(const z of ZR)for(const s of[-1,1]){const lz=z+s*(RW+.7);if(lz<LZ0+1||lz>LZ1-1)continue;for(let x=LX0+12;x<LX1-5;x+=22){if(XR.some(xr=>Math.abs(x-xr)<10))continue;lamp(G,x,lz,0,-s)}}
 for(let z=LZ0+6;z<LZ1-4;z+=13)palm(G,152+rnd()*5,z+rnd()*4,7+rnd()*4,0);
 for(let x=LX0+8;x<LX1-20;x+=19){palm(G,x+rnd()*4,LZ1-6-rnd()*4,6+rnd()*3,0);palm(G,x+rnd()*4,LZ0+6+rnd()*4,6+rnd()*3,0)}
 for(let z=LZ0+8;z<LZ1;z+=19)palm(G,LX0+6+rnd()*4,z+rnd()*4,6+rnd()*3,0);
 const tc=['#ff6b6b','#ffd45d','#33c3e6','#ff8fc7'];
 for(let k=0;k<5;k++){const z=-130+k*65,x=178;for(const a of[-1,1])for(const c of[-1,1])G.b(x+a*1.1,1.2,z+c*1.1,.1,1.4,.1,'#d8d2c4');G.b(x,2.9,z,1.5,.08,1.5,'#d8d2c4');G.b(x,3.8,z,1.25,.9,1.25,tc[k%4]);G.b(x-1.26,3.8,z,.01,.5,.9,'#1e2f3a',0,0,4);G.b(x,4.85,z,1.6,.12,1.6,'#f4f0e6');solids.push({x0:x-1.5,x1:x+1.5,z0:z-1.5,z1:z+1.5,h:5})}
 for(let k=0;k<34;k++){const x=164+rnd()*20,z=SZ0+12+rnd()*(SZ1-SZ0-24),c=pick(['#ff3fa4','#33e6ff','#ffd45d','#ff8a3d','#ffffff'],rnd);G.b(x,1.2,z,.05,1.25,.05,'#e8e8e8');G.b(x,2.45,z,1.3,.07,1.3,c,0,rnd()*3);G.b(x,2.5,z,.7,.07,.7,'#ffffff',0,rnd()*3);if(rnd()<.7)G.b(x+1.6,-.03,z,.5,.02,1,pick(['#ff6b6b','#5dd3ff','#ffe066','#9b7bff'],rnd),0,0,32)}
 G.b(215,.3,20,32,.15,3,'#8a6b4f');for(let x=186;x<246;x+=6)for(const s of[-1,1])G.b(x,-.5,20+s*2.6,.18,.9,.18,'#5a4632');
 for(const s of[-1,1])G.b(215,.9,20+s*2.9,32,.05,.05,'#e8e0d0');
 return G.build();
}
function buildMap(){const k=2,c=document.createElement('canvas');c.width=460*k;c.height=400*k;const x=c.getContext('2d');
 const U=v=>(v-MX0)*k,V=v=>(v-MZ0)*k;
 x.fillStyle='#1c4b63';x.fillRect(0,0,c.width,c.height);
 x.fillStyle='#8a7a52';x.fillRect(U(SX0),V(SZ0),(SX1-SX0)*k,(SZ1-SZ0)*k);
 x.fillStyle='#454b52';x.fillRect(U(LX0),V(LZ0),(LX1-LX0)*k,(LZ1-LZ0)*k);
 x.fillStyle='#8a939b';for(const r of XR)x.fillRect(U(r-RW),V(LZ0),RW*2*k,(LZ1-LZ0)*k);for(const r of ZR)x.fillRect(U(LX0),V(r-RW),(LX1-LX0)*k,RW*2*k);
 for(const b of blocks){x.fillStyle=b.type==='park'?'#3d6b3a':b.type==='plaza'?'#6b6155':'#353a40';x.fillRect(U(b.bx-14),V(b.bz-14),28*k,28*k)}
 x.fillStyle='#24282d';for(const s of solids)if(s.bld)x.fillRect(U(s.x0),V(s.z0),(s.x1-s.x0)*k,(s.z1-s.z0)*k);
 x.fillStyle='#6b5238';x.fillRect(U(183),V(17),64*k,6*k);
 return c}

/* ================= CHARACTERS & CARS ================= */
function charMeshes(v){return{
 torso:mk(g=>{g.b(0,1.28,0,.4,.36,.21,v.shirt);g.b(0,.95,0,.38,.06,.2,v.belt);if(v.jacket){g.b(.26,1.3,.215,.12,.34,.01,v.jacket,0,0,2);g.b(-.26,1.3,.215,.12,.34,.01,v.jacket,0,0,2)}}),
 head:mk(g=>{g.b(0,1.83,0,.21,.23,.21,v.skin);g.b(0,2.05,-.02,.23,.07,.23,v.hair);g.b(0,1.93,-.19,.22,.15,.04,v.hair);if(v.shades)g.b(0,1.87,.215,.19,.045,.012,'#0b0b0d');g.b(0,1.6,0,.1,.06,.1,v.skin)}),
 arm:mk(g=>{g.b(0,-.22,0,.11,.22,.12,v.jacket||v.shirt);g.b(0,-.6,0,.09,.2,.1,v.skin)}),
 leg:mk(g=>{g.b(0,-.43,0,.15,.43,.16,v.pants);g.b(0,-.9,.05,.15,.05,.21,v.shoes)})}}
const SKIN=['#f1c7a5','#d9a27c','#b97c59','#8d5a3b','#5e3b26','#e8b48f'];
const HAIR=['#1b1411','#3a2618','#6b4a2a','#c9a15a','#0d0d0d','#8a3b2a','#d8d0c0'];
const SHIRT=['#ff6b9d','#33c3e6','#ffffff','#ffd45d','#7bd389','#ff8a3d','#9b7bff','#e8e1d2','#2f4f6f','#d94f4f'];
const PANTS=['#2a2f38','#3b5a86','#e8e1d2','#6b5a45','#1d1d1d','#8a8f96'];
const NPCV=[];for(let i=0;i<12;i++)NPCV.push(charMeshes({skin:pick(SKIN),hair:pick(HAIR),shirt:pick(SHIRT),pants:pick(PANTS),shoes:pick(['#f2f2f2','#1a1a1a','#8a5a3a']),belt:'#2a2220',shades:R()<.4,jacket:R()<.2?pick(['#e8e1d2','#1d2230','#ff6b9d']):null}));
const HERO=charMeshes({skin:'#c99272',hair:'#16100d',shirt:'#f4efe4',jacket:'#2d6f8a',pants:'#2b2f36',shoes:'#f2f2f2',belt:'#3a2a1f',shades:true});
const GUN=mk(g=>{g.b(0,-.84,.06,.05,.2,.075,'#16181b');g.b(0,-.74,-.08,.045,.06,.1,'#26292d')});

const CT={sport:{name:'Vento GT',max:37,acc:20},sedan:{name:'Corsa LX',max:29,acc:14},suv:{name:'Ranger XL',max:26,acc:12.5},taxi:{name:'Cab 88',max:28,acc:13.5},police:{name:'Patrol',max:34,acc:18}};
const CARCOL=['#c9d1d9','#17191d','#ececec','#a3172a','#1e4fa3','#e36b9c','#23a9a0','#e8a23a','#5a3d8a','#2f6b3a','#7a8591','#f0d9b5','#ff5e3a'];
function carMesh(shape,body,opt){opt=opt||{};return mk(g=>{
 const L=shape==='sport'?2.25:shape==='suv'?2.25:2.15,Wd=shape==='suv'?1.02:.98;
 const bh=shape==='sport'?.28:shape==='suv'?.42:.33,by=shape==='sport'?.55:shape==='suv'?.82:.64;
 g.b(0,by,0,Wd,bh,L,body,-.6);g.b(0,by-bh-.08,0,Wd-.05,.1,L-.1,'#15171a');
 const ch=shape==='sport'?.24:shape==='suv'?.4:.31,cz=shape==='sport'?-.35:-.2,cl=shape==='sport'?.95:shape==='suv'?1.55:1.15,cy=by+bh+ch;
 g.b(0,cy,cz,Wd-.12,ch,cl,body,-.6);const gc='#16222c';
 g.b(0,cy,cz+cl+.01,Wd-.2,ch-.05,.01,gc,-1,0,2);g.b(0,cy,cz-cl-.01,Wd-.2,ch-.05,.01,gc,-1,0,1);
 g.b(Wd-.11,cy,cz,.01,ch-.05,cl-.12,gc,-1,0,8);g.b(-Wd+.11,cy,cz,.01,ch-.05,cl-.12,gc,-1,0,4);
 for(const sx of[-1,1])for(const sz of[-1,1]){g.b(sx*(Wd-.08),.36,sz*(L-.62),.2,.36,.36,'#0e0f11');g.b(sx*(Wd+.13),.36,sz*(L-.62),.02,.2,.2,'#aab1b8',-.5)}
 g.b(.62,by+.05,L+.01,.22,.08,.02,'#fff4d6',1,0,2);g.b(-.62,by+.05,L+.01,.22,.08,.02,'#fff4d6',1,0,2);
 g.b(.66,by+.08,-L-.01,.24,.07,.02,'#ff2a3a',1,0,1);g.b(-.66,by+.08,-L-.01,.24,.07,.02,'#ff2a3a',1,0,1);
 g.b(0,by-.12,L+.03,Wd-.04,.1,.04,'#23262b');g.b(0,by-.12,-L-.03,Wd-.04,.1,.04,'#23262b');
 if(shape==='sport')g.b(0,by+bh+.25,-L+.2,Wd-.1,.03,.22,body,-.6);
 if(opt.taxi){g.b(0,cy+ch+.12,cz,.42,.12,.2,'#ffe066',1);g.b(0,by,0,Wd+.01,.05,L-.3,'#1a1a1a',0,0,12)}
 if(opt.police){g.b(0,by,.1,Wd+.01,bh*.72,.95,'#f2f2f2',-.4,0,12);
  g.b(.32,cy+ch+.08,cz,.3,.08,.16,'#ff2233',opt.lp===0?1:0);g.b(-.32,cy+ch+.08,cz,.3,.08,.16,'#2266ff',opt.lp===1?1:0)}})}
const meshCache={};
function carMeshFor(c){const shape=c.type==='police'||c.type==='taxi'?'sedan':c.type;
 if(c.burnt){const k='burnt'+shape;return meshCache[k]||(meshCache[k]=carMesh(shape,'#1b1b1b'))}
 const lp=c.police?(Math.floor(gameT*6)%2):0,k=c.type+c.color+(c.police?'p'+lp:'');
 return meshCache[k]||(meshCache[k]=carMesh(shape,c.type==='taxi'?'#f2c230':c.type==='police'?'#16181c':c.color,{taxi:c.type==='taxi',police:c.police,lp}))}

/* ================= STATE ================= */
let world=null,mapImg=null,ready=false,started=false,paused=false;
let gameT=0,tod=.72;const DAY=540;
const P={x:0,y:SW,z:-8,yaw:Math.PI,vx:0,vz:0,vy:0,onGround:true,hp:100,arm:50,hitCD:0,phase:0,spd:0,aimT:0,jumpReq:false,muzzle:[0,1.5,0]};
let cash=2450,dispCash=2450,ammo=18,reserve=108,fireCD=0,reloadT=0,flashT=0,hitT=0;
let wanted=0,loseT=0,bustT=0,spawnCD=0,dead=false,deadT=0,deadKind='';
let mode='third',inCar=false,car=null,camYaw=Math.PI,camPitch=0,lastMouseT=-9,shakeA=0;
const cars=[],npcs=[],parts=[],tracers=[];
const key=new Set();const inp={x:0,y:0,run:false,brake:false,fire:false,aim:false};const tj={x:0,y:0};
let touchFire=false,touchRun=false,touchBrake=false,mouseDown=false,rightDown=false;
const CAM={eye:[0,10,0],dir:[0,0,1],vp:ID,fov:1};

function newCar(o){return Object.assign({x:0,z:0,y:0,yaw:0,vx:0,vz:0,speed:0,hp:100,ai:false,dx:0,dz:1,road:0,cruise:10+R()*6,ign:0,type:'sedan',color:'#c9d1d9',police:false,chase:false,burnt:false,burnT:0,stuck:0,rev:0,steerV:0,shootCD:1},o)}
function randType(){const r=R();return r<.42?'sedan':r<.58?'sport':r<.8?'suv':'taxi'}
function placeTraffic(c,far){for(let t=0;t<40;t++){const horiz=R()<.5;let x,z,dx=0,dz=0,road;
  if(horiz){road=pick(ZR);dx=R()<.5?1:-1;x=XR[0]+R()*(XR[XR.length-1]-XR[0]);z=road+dx*3}
  else{road=pick(XR);dz=R()<.5?1:-1;z=ZR[0]+R()*(ZR[ZR.length-1]-ZR[0]);x=road-dz*3}
  if(far&&Math.hypot(x-P.x,z-P.z)<far)continue;
  if(cars.some(o=>o!==c&&Math.abs(o.x-x)<10&&Math.abs(o.z-z)<10))continue;
  Object.assign(c,{x,z,dx,dz,road,yaw:Math.atan2(dx,dz),speed:6,vx:dx*6,vz:dz*6,ai:true,burnt:false,hp:100,ign:0,parked:false,type:randType(),color:pick(CARCOL)});return true}return false}
function perim(bx,bz,s){const h=12.8,L=2*h,seg=Math.floor(s/L)%4,t=s-Math.floor(s/L)*L;
 if(seg===0)return[bx-h+t,bz-h];if(seg===1)return[bx+h,bz-h+t];if(seg===2)return[bx+h-t,bz+h];return[bx-h,bz+h-t]}
const PER=4*25.6;
function placeNpc(n,far){for(let t=0;t<30;t++){
  if(n.free){const x=164+R()*22,z=SZ0+10+R()*(SZ1-SZ0-20);if(far&&t<29&&Math.hypot(x-P.x,z-P.z)<far)continue;Object.assign(n,{x,z,y:-.05,alive:true,flee:0,yaw:R()*6.28,wt:R()*3});break}
  const b=pick(blocks),s=R()*PER,p=perim(b.bx,b.bz,s);if(far&&t<29&&Math.hypot(p[0]-P.x,p[1]-P.z)<far)continue;
  Object.assign(n,{bx:b.bx,bz:b.bz,s,x:p[0],z:p[1],y:SW,alive:true,dir:R()<.5?1:-1,flee:0});break}
 Object.assign(n,{deadT:0,vy:0,kvx:0,kvz:0,fall:0,phase:R()*6,spd:1.1+R()*.5,cur:0})}

/* ================= COLLISION ================= */
function groundAt(x,z){const i=Math.round((x+160)/40),j=Math.round((z+120)/40);
 if(i>=0&&i<8&&j>=0&&j<7&&Math.abs(x-(-160+40*i))<14&&Math.abs(z-(-120+40*j))<14)return SW;
 if(x>=LX0&&x<=LX1&&z>=LZ0&&z<=LZ1)return .02;
 if(x>186&&x<247&&Math.abs(z-20)<3)return .45;
 return -.05}
function collide(o,r,y){let hit=null;for(const s of solids){if(y>s.h-.2)continue;if(o.x<s.x0-r||o.x>s.x1+r||o.z<s.z0-r||o.z>s.z1+r)continue;
  const cx=clamp(o.x,s.x0,s.x1),cz=clamp(o.z,s.z0,s.z1);let dx=o.x-cx,dz=o.z-cz;const d2=dx*dx+dz*dz;
  if(d2>=r*r)continue;
  if(d2>1e-8){const d=Math.sqrt(d2),p=r-d;dx/=d;dz/=d;o.x+=dx*p;o.z+=dz*p;hit=[dx,dz,p]}
  else{const l=o.x-s.x0,rr=s.x1-o.x,b=o.z-s.z0,f=s.z1-o.z,m=Math.min(l,rr,b,f);
   if(m===l){o.x=s.x0-r;hit=[-1,0,r]}else if(m===rr){o.x=s.x1+r;hit=[1,0,r]}else if(m===b){o.z=s.z0-r;hit=[0,-1,r]}else{o.z=s.z1+r;hit=[0,1,r]}}}
 return hit}
function inSolid(x,y,z,pad){for(const s of solids)if(y<s.h&&x>s.x0-pad&&x<s.x1+pad&&z>s.z0-pad&&z<s.z1+pad)return true;return false}
function bounds(o,foot){const x0=SX0+1,x1=foot?247:SX1-2,z0=SZ0+1,z1=SZ1-1;
 if(foot&&o.x>SX1-1&&!(o.x<247&&Math.abs(o.z-20)<2.6))o.x=SX1-1;
 if(o.x<x0)o.x=x0;if(o.x>x1)o.x=x1;if(o.z<z0)o.z=z0;if(o.z>z1)o.z=z1}
function rayBox(o,d,s){let t0=0,t1=1e9;const mn=[s.x0,0,s.z0],mx=[s.x1,s.h,s.z1];
 for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(o[i]<mn[i]||o[i]>mx[i])return null;continue}
  let a=(mn[i]-o[i])/d[i],b=(mx[i]-o[i])/d[i];if(a>b){const q=a;a=b;b=q}t0=Math.max(t0,a);t1=Math.min(t1,b);if(t0>t1)return null}return t0}
function raySphere(o,d,c,r){const ox=c[0]-o[0],oy=c[1]-o[1],oz=c[2]-o[2],t=ox*d[0]+oy*d[1]+oz*d[2];if(t<0)return null;const q=ox*ox+oy*oy+oz*oz-t*t;return q<r*r?t-Math.sqrt(r*r-q):null}

/* ================= AUDIO ================= */
let AC=null,master,noiseBuf,engO,engF,engG,sirO,sirG,radioG,radioOn=true,muted=false,nextNote=0,stepI=0;
function initAudio(){try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=.5;master.connect(AC.destination);
 noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 engO=AC.createOscillator();engO.type='sawtooth';engF=AC.createBiquadFilter();engF.type='lowpass';engF.frequency.value=380;engG=AC.createGain();engG.gain.value=0;engO.connect(engF);engF.connect(engG);engG.connect(master);engO.start();
 sirO=AC.createOscillator();sirO.type='triangle';sirG=AC.createGain();sirG.gain.value=0;sirO.connect(sirG);sirG.connect(master);sirO.start();
 radioG=AC.createGain();radioG.gain.value=0;radioG.connect(master)}catch(e){AC=null}}
function noise(dur,freq,vol,type,out){if(!AC)return;const s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type=type||'lowpass';f.frequency.value=freq;const g=AC.createGain(),t=AC.currentTime;
 g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(out||master);s.start(t);s.stop(t+dur+.05)}
function blip(freq,dur,vol,type,at,out,cut){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain(),t=at||AC.currentTime;o.type=type||'sine';o.frequency.setValueAtTime(freq,t);
 let node=o;if(cut){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;o.connect(f);node=f}
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+dur);node.connect(g);g.connect(out||master);o.start(t);o.stop(t+dur+.05)}
const sfx={
 gun(v){v=v===undefined?1:v;noise(.16,2600,.55*v);blip(120,.12,.4*v,'sine')},
 boom(){noise(1.6,420,1);blip(55,.9,.7,'sine')},
 crash(v){noise(.3,900,clamp(v/20,.1,.6))},
 click(){blip(900,.05,.2,'square')},
 cash(){blip(988,.1,.2,'square');if(AC)blip(1318,.22,.2,'square',AC.currentTime+.08)},
 fail(){blip(220,.4,.25,'sawtooth',0,null,900)}};
const BPM=104,STEP=60/BPM/2;
const BASS=[45,45,57,45,45,57,45,55,41,41,53,41,41,53,41,52,48,48,60,48,48,60,48,55,43,43,55,43,43,55,47,50];
const CHORD=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]];
const LEAD=[69,0,72,0,76,0,74,72,69,0,0,0,65,0,67,69,72,0,0,76,74,72,67,0,71,0,74,0,67,0,0,0];
const mtof=m=>440*Math.pow(2,(m-69)/12);
function nz(t,type,freq,vol,dur){const s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;const g=AC.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(radioG);s.start(t);s.stop(t+dur+.03)}
function radioTick(on){if(!AC)return;if(!on){nextNote=AC.currentTime+.05;return}
 while(nextNote<AC.currentTime+.25){const t=nextNote,i=stepI%32;
  blip(mtof(BASS[i]),STEP*.95,.2,'sawtooth',t,radioG,650);
  if(i%4===0){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+.18);g.gain.setValueAtTime(.7,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g);g.connect(radioG);o.start(t);o.stop(t+.3)}
  if(i%8===4)nz(t,'bandpass',1800,.35,.2);
  nz(t,'highpass',7000,i%2?.05:.1,.05);
  if(i%8===0)for(const m of CHORD[(i/8)|0]){blip(mtof(m),STEP*7.6,.045,'sawtooth',t,radioG,1500);blip(mtof(m)*1.006,STEP*7.6,.035,'sawtooth',t,radioG,1500)}
  if(LEAD[i])blip(mtof(LEAD[i]),STEP*1.7,.06,'square',t,radioG,2600);
  nextNote+=STEP;stepI++}}

/* ================= UI HELPERS ================= */
const hc={};function setT(id,v){if(hc[id]!==v){hc[id]=v;$(id).textContent=v}}
let toastTO=0,bannerTO=0,zoneTO=0,vehTO=0;
function toast(t){const e=$('toast');e.textContent=t;e.style.opacity=1;clearTimeout(toastTO);toastTO=setTimeout(()=>e.style.opacity=0,1800)}
function banner(a,b,fail){const e=$('banner');$('bannerT').textContent=a;$('bannerS').textContent=b||'';e.classList.toggle('fail',!!fail);e.classList.add('on');clearTimeout(bannerTO);bannerTO=setTimeout(()=>e.classList.remove('on'),3200)}
function showVeh(){if(!car)return;$('vehName').textContent=CT[car.type].name;$('radioName').textContent=radioOn?'Радио: Neon Wave 88.1':'Радио выключено';const e=$('veh');e.classList.add('on');clearTimeout(vehTO);vehTO=setTimeout(()=>e.classList.remove('on'),3500)}
let curZone='';function zoneName(x,z){if(x>160)return'Neon Beach';if(x>100)return'Ocean Drive';if(Math.abs(x)<=60&&Math.abs(z)<=60)return'Downtown';if(z>60)return'Palm Heights';if(z<-60)return'Harbor Side';return x<-100?'West Gardens':'Midtown'}
const fmt=n=>'$'+Math.round(n).toLocaleString('en-US');

/* ================= MISSIONS ================= */
const MIS=[
 {type:'car',text:'Угоните машину: подойдите к любому авто и нажмите E',reward:150},
 {type:'goto',text:'Прокатитесь на набережную Ocean Drive',x:150,z:-46,car:true,reward:400},
 {type:'goto',text:'Выйдите из машины и дойдите до вышки спасателей на пляже',x:176,z:0,foot:true,reward:250},
 {type:'goto',text:'Прогуляйтесь до конца пирса',x:238,z:20,foot:true,reward:300},
 {type:'lose',text:'Полиция вас заметила. Уйдите от погони',reward:900}];
let mi=0,cur=null,mTimer=0,nextMisT=2.5;
function startMission(){
 if(mi<MIS.length)cur=Object.assign({},MIS[mi]);
 else{const far=blocks.filter(b=>Math.hypot(b.bx-P.x,b.bz-P.z)>70&&b.type!=='hotel');const b=pick(far.length?far:blocks);const sd=pick([[0,-15.2],[0,15.2],[-15.2,0],[15.2,0]]);
  cur={type:'timed',text:'Срочная доставка: успейте к точке',x:b.bx+sd[0],z:b.bz+sd[1]};const d=Math.hypot(cur.x-P.x,cur.z-P.z);cur.time=Math.round(d/11+18);cur.reward=Math.round((250+d*4)/10)*10;mTimer=cur.time}
 if(cur.type==='lose')wanted=Math.max(wanted,2.01);
 setT('objText',cur.text);sfx.click()}
function completeMission(){cash+=cur.reward;banner('Задание выполнено','+'+fmt(cur.reward));sfx.cash();if(cur.type!=='timed')mi++;cur=null;nextMisT=3.5;reserve=Math.min(216,reserve+36)}
function failMission(msg){banner('Задание провалено',msg,true);sfx.fail();cur=null;nextMisT=3.5}
function missionUpdate(dt){
 if(!cur){nextMisT-=dt;if(nextMisT<=0&&!dead)startMission();if(!cur){setT('objText','Свободная прогулка');setT('objInfo','')}return}
 let info='';
 if(cur.type==='car'&&inCar)return completeMission();
 if(cur.type==='goto'||cur.type==='timed'){const d=Math.hypot(P.x-cur.x,P.z-cur.z);info=Math.round(d)+' м';
  if(d<4.5){if(cur.car&&!inCar)info='Нужна машина';else if(cur.foot&&inCar)info='Выйдите из машины (E)';else return completeMission()}
  if(cur.type==='timed'){mTimer-=dt;info+=' · '+Math.max(0,Math.ceil(mTimer))+' с';if(mTimer<=0)return failMission('Время вышло')}}
 if(cur.type==='lose'){const s=Math.ceil(wanted-1e-6);info=s?'Скройтесь из вида полиции':'';if(!s)return completeMission()}
 setT('objInfo',info)}

/* ================= GAME ACTIONS ================= */
function wantedAdd(v,min){wanted=clamp(Math.max(wanted+v,min||0),0,5);loseT=0}
function panic(x,z,r){for(const n of npcs){if(!n.alive)continue;if(Math.hypot(n.x-x,n.z-z)<r){n.flee=6+R()*3;
  if(!n.free){const a=perim(n.bx,n.bz,(n.s+1)%PER),b=perim(n.bx,n.bz,(n.s-1+PER)%PER);n.dir=Math.hypot(a[0]-x,a[1]-z)>Math.hypot(b[0]-x,b[1]-z)?1:-1}}}}
function killNpc(n,kvx,kvz,vy){n.alive=false;n.deadT=0;n.kvx=kvx||0;n.kvz=kvz||0;n.vy=vy||0;n.fall=0;panic(n.x,n.z,35)}
function damagePlayer(d){if(dead)return;if(P.arm>0){const a=Math.min(P.arm,d*.7);P.arm-=a;d-=a}P.hp-=d;$('dmg').style.opacity=.9;setTimeout(()=>$('dmg').style.opacity=0,180);if(P.hp<=0){P.hp=0;die('Вы погибли','Больница Vice General: −$350')}}
function die(t,s){if(dead)return;dead=true;deadT=5;deadKind=t;if(inCar)exitCar(true);$('deadT').textContent=t;$('deadS').textContent=s;$('dead').classList.add('on');if(cur&&cur.type!=='car')failMission('')}
function respawn(){dead=false;$('dead').classList.remove('on');const fine=deadKind==='Вы погибли'?350:500;cash=Math.max(0,cash-fine);
 Object.assign(P,{x:0,z:-8,y:SW,vx:0,vz:0,vy:0,hp:100,arm:Math.max(P.arm,25),yaw:Math.PI});camYaw=Math.PI;camPitch=0;wanted=0;ammo=18;reserve=Math.max(reserve,54);
 for(let i=cars.length-1;i>=0;i--)if(cars[i].police)cars.splice(i,1);toast(deadKind==='Вы погибли'?'Больница: −$350':'Штраф: −$500')}
function explode(x,z,byPlayer){emit(x,1,z,34,'fire',3);emit(x,1.5,z,26,'smoke',2);emit(x,1,z,14,'debris',3);sfx.boom();
 const dp=Math.hypot(x-P.x,z-P.z);shakeA=Math.max(shakeA,clamp(1.3-dp/45,0,1.3));
 for(const n of npcs)if(n.alive){const d=Math.hypot(n.x-x,n.z-z);if(d<7)killNpc(n,(n.x-x)/(d||1)*8,(n.z-z)/(d||1)*8,6)}
 if(!inCar&&dp<7)damagePlayer(90*(1-dp/7));
 for(const c of cars)if(!c.burnt){const d=Math.hypot(c.x-x,c.z-z);if(d<7&&d>.1){c.hp-=55*(1-d/7);c.vx+=(c.x-x)/d*6;c.vz+=(c.z-z)/d*6;c.ai=false}}
 if(byPlayer)wantedAdd(1,1)}
function destroyCar(c){c.burnt=true;c.ai=false;c.hp=0;c.burnT=40;c.parked=false;explode(c.x,c.z,c.lastHitByPlayer||c===car);if(c===car)die('Вы погибли','Больница Vice General: −$350')}
function enterCar(){let best=null,bd=3.6;for(const c of cars){if(c.burnt)continue;const d=Math.hypot(c.x-P.x,c.z-P.z);if(d<bd){bd=d;best=c}}
 if(!best)return;const moving=best.ai&&Math.abs(best.speed)>1;car=best;inCar=true;car.ai=false;car.chase=false;car.parked=false;
 if(car.police){car.police=false;wantedAdd(1,2);toast('Вы угнали патрульную машину!')}else if(moving){toast('Угон!');panic(car.x,car.z,20)}
 camYaw=car.yaw;showVeh();sfx.click();radioTick(false)}
function exitCar(force){if(!car)return;const c=car,lx=Math.cos(c.yaw),lz=-Math.sin(c.yaw);
 let px=c.x+lx*2.3,pz=c.z+lz*2.3;if(inSolid(px,1,pz,.4)){px=c.x-lx*2.3;pz=c.z-lz*2.3}
 P.x=px;P.z=pz;P.y=groundAt(px,pz);P.vx=P.vz=0;P.yaw=c.yaw;inCar=false;car=null;$('veh').classList.remove('on');if(!force)sfx.click()}
function reload(){if(reloadT>0||ammo===18||reserve<=0)return;reloadT=1.1;toast('Перезарядка')}
function emit(x,y,z,n,kind,spread){spread=spread||1;for(let i=0;i<n;i++){if(parts.length>=380)parts.shift();
 const p={x,y,z,vx:(R()-.5)*spread*2,vy:R()*spread*1.5,vz:(R()-.5)*spread*2,life:0,max:1,kind,s:.2};
 if(kind==='fire'){p.max=.5+R()*.5;p.s=.5+R()*.7;p.vy=2+R()*4}else if(kind==='smoke'){p.max=1.6+R()*1.6;p.s=.4+R()*.5;p.vy=1.2+R()*1.5;p.vx*=.4;p.vz*=.4}
 else if(kind==='spark'){p.max=.2+R()*.2;p.s=.05;p.vy=R()*4}else if(kind==='debris'){p.max=2.5;p.s=.12+R()*.2;p.vy=4+R()*7}
 parts.push(p)}}
function shoot(){if(inCar||dead||reloadT>0||fireCD>0)return;if(ammo<=0){reload();return}
 fireCD=.16;ammo--;P.aimT=1.6;flashT=.06;sfx.gun();shakeA=Math.max(shakeA,.12);
 const o=CAM.eye,d=CAM.dir,tmin=Math.max(0,(P.x-o[0])*d[0]+(P.y+1.4-o[1])*d[1]+(P.z-o[2])*d[2]-.4);
 let best=110,hit=null;
 for(const s of solids){const t=rayBox(o,d,s);if(t!==null&&t>tmin&&t<best){best=t;hit='wall'}}
 if(d[1]<-.001){const t=(.05-o[1])/d[1];if(t>tmin&&t<best){best=t;hit='ground'}}
 for(const n of npcs){if(!n.alive)continue;const t=raySphere(o,d,[n.x,n.y+1.1,n.z],.7);if(t!==null&&t>tmin&&t<best){best=t;hit=n}}
 for(const c of cars){if(c.burnt)continue;const t=raySphere(o,d,[c.x,.9,c.z],1.6);if(t!==null&&t>tmin&&t<best){best=t;hit=c}}
 const hp=[o[0]+d[0]*best,o[1]+d[1]*best,o[2]+d[2]*best];
 tracers.push({a:P.muzzle.slice(),b:hp,t:.06});
 if(hit&&hit!=='wall'&&hit!=='ground'){
  if(hit.hp!==undefined){hit.hp-=11;hit.lastHitByPlayer=true;emit(hp[0],hp[1],hp[2],6,'spark',2);if(hit.ai){hit.ai=false;hit.speed*=.5}if(hit.police)wantedAdd(.5,2)}
  else{killNpc(hit,d[0]*3,d[2]*3,1);wantedAdd(.7,1);emit(hp[0],hp[1],hp[2],4,'spark',1)}
  hitT=.15}
 else if(hit)emit(hp[0],hp[1],hp[2],5,'spark',1.5);
 panic(P.x,P.z,32);
 if(npcs.some(n=>n.alive&&Math.hypot(n.x-P.x,n.z-P.z)<25)||cars.some(c=>c.police&&Math.hypot(c.x-P.x,c.z-P.z)<60))wantedAdd(.08,1);
 if(ammo<=0)reload()}

/* ================= VEHICLES ================= */
function physCar(c,thr,steer,hb,dt){const def=CT[c.type],fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),rx=-fz,rz=fx;
 let vF=c.vx*fx+c.vz*fz,vL=c.vx*rx+c.vz*rz;const max=def.max*(c.hp<30?.7:1);
 if(thr>0)vF+=(vF<-.5?26:def.acc)*thr*dt;else if(thr<0){if(vF>.5)vF-=26*(-thr)*dt;else vF-=def.acc*.6*(-thr)*dt}
 vF=clamp(vF,-10,max);vF*=Math.exp(-(thr===0?.55:.12)*dt);if(hb)vF*=Math.exp(-1.1*dt);if(c.burnt)vF*=Math.exp(-3*dt);
 c.steerV=lerp(c.steerV,steer,Math.min(1,dt*8));
 c.yaw-=c.steerV*(1.95/(1+Math.abs(vF)/30))*clamp(vF/5,-1,1)*dt*(hb?1.55:1);
 vL*=Math.exp(-(hb?1.4:9)*dt);
 const nfx=Math.sin(c.yaw),nfz=Math.cos(c.yaw);c.vx=nfx*vF-nfz*vL;c.vz=nfz*vF+nfx*vL;c.speed=vF;
 c.x+=c.vx*dt;c.z+=c.vz*dt;
 const h=collide(c,1.55,.5);if(h){const vn=c.vx*h[0]+c.vz*h[1];if(vn<0){c.vx-=h[0]*vn*1.45;c.vz-=h[1]*vn*1.45;const imp=-vn;if(imp>6){c.hp-=(imp-5)*.8;if(c===car){shakeA=Math.max(shakeA,imp*.025);sfx.crash(imp)}}}}
 const bx=c.x,bz=c.z;bounds(c,false);if(bx!==c.x)c.vx*=-.3;if(bz!==c.z)c.vz*=-.3;
 c.y+=(groundAt(c.x,c.z)-c.y)*Math.min(1,dt*10);
 if(hb&&Math.abs(vL)>4&&R()<.5)emit(c.x-nfx*1.6,.3,c.z-nfz*1.6,1,'smoke',.3)}
function aiCar(c,dt){const dx=c.dx,dz=c.dz;let want=c.cruise;
 for(const o of cars){if(o===c)continue;const rx=o.x-c.x,rz=o.z-c.z;if(Math.abs(rx)>12||Math.abs(rz)>12)continue;const ahead=rx*dx+rz*dz;if(ahead>0&&ahead<11){const lat=Math.abs(-rx*dz+rz*dx);if(lat<1.8)want=Math.min(want,Math.max(0,(ahead-5)*1.6))}}
 if(!inCar&&!dead){const rx=P.x-c.x,rz=P.z-c.z,ahead=rx*dx+rz*dz;if(ahead>0&&ahead<10&&Math.abs(-rx*dz+rz*dx)<2)want=Math.min(want,Math.max(0,(ahead-3.5)*1.5))}
 c.speed+=clamp(want-c.speed,-16*dt,5*dt);
 const prev=dx?c.x:c.z;c.x+=dx*c.speed*dt;c.z+=dz*c.speed*dt;c.vx=dx*c.speed;c.vz=dz*c.speed;
 if(dx)c.z+=(c.road+dx*3-c.z)*Math.min(1,dt*3);else c.x+=(c.road-dz*3-c.x)*Math.min(1,dt*3);
 c.ign-=c.speed*dt;const now=dx?c.x:c.z,lines=dx?XR:ZR;
 if(c.ign<=0)for(const L of lines){if((prev<L&&now>=L)||(prev>L&&now<=L)){
   const opts=[],perp=dx?ZR:XR,pmin=perp[0],pmax=perp[perp.length-1],lmin=lines[0],lmax=lines[lines.length-1],s=dx||dz;
   if((s>0&&L<lmax)||(s<0&&L>lmin))opts.push([dx,dz],[dx,dz]);
   if(c.road<pmax)opts.push(dx?[0,1]:[1,0]);if(c.road>pmin)opts.push(dx?[0,-1]:[-1,0]);
   const ch=opts.length?pick(opts):[-dx,-dz];
   if(ch[0]!==dx||ch[1]!==dz){c.dx=ch[0];c.dz=ch[1];c.road=L;c.ign=9}
   break}}
 c.yaw=turnTo(c.yaw,Math.atan2(c.dx,c.dz),dt*5);
 c.y+=(groundAt(c.x,c.z)-c.y)*Math.min(1,dt*10);
 if(c.x<LX0-5||c.x>LX1+5||c.z<LZ0-5||c.z>LZ1+5)placeTraffic(c,70)}
function copAI(c,dt){
 if(!c.chase){physCar(c,0,0,true,dt);return}
 const tx=P.x-c.x,tz=P.z-c.z,d=Math.hypot(tx,tz),da=angD(Math.atan2(tx,tz),c.yaw);
 let thr=d>16?1:d>9?.3:(c.speed>.5?-1:0),st=clamp(-da*2.2,-1,1);
 if(Math.abs(da)>2.3&&d>12)thr=.6;
 if(c.rev>0){c.rev-=dt;thr=-1;st=-st}else{if(Math.abs(c.speed)<1.2&&thr>0){c.stuck+=dt;if(c.stuck>1.2){c.rev=1.1;c.stuck=0}}else c.stuck=0}
 physCar(c,thr,st,false,dt)}
function carCollisions(){for(let i=0;i<cars.length;i++){const a=cars[i];for(let j=i+1;j<cars.length;j++){const b=cars[j];if(a.ai&&b.ai)continue;
  const dx=b.x-a.x,dz=b.z-a.z;if(Math.abs(dx)>3.6||Math.abs(dz)>3.6)continue;const d=Math.hypot(dx,dz);if(d>=3.1||d<.001)continue;
  const nx=dx/d,nz=dz/d,pen=(3.1-d)/2;a.x-=nx*pen;a.z-=nz*pen;b.x+=nx*pen;b.z+=nz*pen;
  const rv=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;if(rv<0){const J=-1.3*rv/2;a.vx-=nx*J;a.vz-=nz*J;b.vx+=nx*J;b.vz+=nz*J;const imp=-rv;
   if(imp>4){for(const c of[a,b]){if(c.ai){c.ai=false;c.speed=0}if(imp>8)c.hp-=(imp-6)*.7}
    if(a===car||b===car){sfx.crash(imp);shakeA=Math.max(shakeA,imp*.02);const o=a===car?b:a;o.lastHitByPlayer=true;if(o.police)wantedAdd(.3,1)}}}}}}
function carsUpdate(dt){
 for(const c of cars){if(c===car)continue;
  if(c.burnt){physCar(c,0,0,true,dt);c.burnT-=dt;if(c.burnT>0&&R()<dt*8)emit(c.x,1.2,c.z,1,R()<.3?'fire':'smoke',.5);continue}
  if(c.police)copAI(c,dt);else if(c.ai)aiCar(c,dt);else physCar(c,0,0,true,dt);
  if(c.hp<35&&R()<dt*4)emit(c.x+Math.sin(c.yaw)*1.7,1.1,c.z+Math.cos(c.yaw)*1.7,1,'smoke',.3);
  if(c.hp<=0)destroyCar(c)}
 if(car){if(car.hp<35&&R()<dt*5)emit(car.x+Math.sin(car.yaw)*1.7,1.1,car.z+Math.cos(car.yaw)*1.7,1,'smoke',.3);if(car.hp<=0&&!car.burnt)destroyCar(car)}
 carCollisions();
 for(const c of cars){if(c===car||c.police||c.ai||c.parked)continue;if(Math.hypot(c.x-P.x,c.z-P.z)>230)placeTraffic(c,120)}}

/* ================= POLICE ================= */
function spawnCop(){for(let t=0;t<30;t++){const a=R()*6.283,r=75+R()*35;let x=P.x+Math.sin(a)*r,z=P.z+Math.cos(a)*r;
 const nx=XR.reduce((b,v)=>Math.abs(v-x)<Math.abs(b-x)?v:b),nz=ZR.reduce((b,v)=>Math.abs(v-z)<Math.abs(b-z)?v:b);
 if(Math.abs(nx-x)<Math.abs(nz-z))x=nx;else z=nz;
 if(x<LX0+3||x>LX1-3||z<LZ0+3||z>LZ1-3||inSolid(x,1,z,2))continue;
 cars.push(newCar({type:'police',police:true,chase:true,x,z,yaw:Math.atan2(P.x-x,P.z-z),hp:140,shootCD:2}));return}}
function policeUpdate(dt){const stars=Math.ceil(wanted-1e-6);let seen=false,nearest=1e9,cops=0,busting=false;
 for(let i=cars.length-1;i>=0;i--){const c=cars[i];if(!c.police||c===car)continue;
  const d=Math.hypot(c.x-P.x,c.z-P.z);if(c.burnt){if(d>150)cars.splice(i,1);continue}
  cops++;c.chase=stars>0&&!dead;if(!stars&&d>120){cars.splice(i,1);continue}
  if(!stars||dead)continue;
  nearest=Math.min(nearest,d);if(d<70)seen=true;
  if(stars>=2&&d<34&&(!inCar||stars>=3)){c.shootCD-=dt;if(c.shootCD<=0){c.shootCD=.55+R()*.9;sfx.gun(clamp(.5-d/80,.1,.5));
    const miss=R()>.32+stars*.06,tx=P.x+(miss?(R()-.5)*4:0),tz=P.z+(miss?(R()-.5)*4:0);tracers.push({a:[c.x,1.5,c.z],b:[tx,P.y+1.2,tz],t:.05});
    if(!miss){if(inCar)car.hp-=4;else damagePlayer(5+stars*2)}}}
  if(stars===1&&!inCar&&d<5.5&&Math.abs(c.speed)<3)busting=true}
 if(busting){bustT+=dt;if(bustT>2.2){bustT=0;die('Вас задержали','Штраф: −$500')}}else bustT=Math.max(0,bustT-dt);
 if(stars&&!dead){spawnCD-=dt;if(cops<Math.min(1+stars,6)&&spawnCD<=0){spawnCop();spawnCD=3.5}
  if(!seen){loseT+=dt;if(loseT>9){wanted=stars-1;loseT=0;toast(wanted?'Розыск снижен':'Вы ушли от погони')}}else loseT=0}
 $('stars').classList.toggle('blink',stars>0&&!seen);
 if(AC){const on=stars>0&&nearest<130&&!muted;sirG.gain.setTargetAtTime(on?.07*clamp(1-nearest/130,0,1):0,AC.currentTime,.1);sirO.frequency.setTargetAtTime(700+320*Math.sin(gameT*4.5),AC.currentTime,.02)}}

/* ================= NPC ================= */
function npcUpdate(dt){for(const n of npcs){
 if(!n.alive){n.fall=Math.min(1,n.fall+dt*3);n.x+=n.kvx*dt;n.z+=n.kvz*dt;n.kvx*=Math.exp(-2.5*dt);n.kvz*=Math.exp(-2.5*dt);n.vy-=18*dt;n.y+=n.vy*dt;const g=groundAt(n.x,n.z);if(n.y<g){n.y=g;n.vy=0}
  n.deadT+=dt;if(n.deadT>30&&Math.hypot(n.x-P.x,n.z-P.z)>50)placeNpc(n,70);continue}
 let sp=n.flee>0?5.2:n.spd;if(n.flee>0)n.flee-=dt;
 if(n.free){n.wt-=dt;if(n.wt<0){n.wt=1+R()*3;n.yaw=R()*6.28;n.stop=R()<.3}if(n.stop&&n.flee<=0)sp=0;
  n.x+=Math.sin(n.yaw)*sp*dt;n.z+=Math.cos(n.yaw)*sp*dt;if(n.x<163||n.x>189||n.z<SZ0+4||n.z>SZ1-4){n.yaw+=Math.PI;n.x=clamp(n.x,163,189);n.z=clamp(n.z,SZ0+4,SZ1-4)}n.y=-.05}
 else{n.s=((n.s+n.dir*sp*dt)%PER+PER)%PER;const p=perim(n.bx,n.bz,n.s),mx=p[0]-n.x,mz=p[1]-n.z;if(Math.abs(mx)+Math.abs(mz)>1e-4)n.yaw=turnTo(n.yaw,Math.atan2(mx,mz),dt*10);n.x=p[0];n.z=p[1];n.y=SW;if(R()<dt*.015)n.dir*=-1}
 n.cur=sp;n.phase+=sp*dt*2.3;
 if(inCar&&Math.abs(car.speed)>4.5&&Math.abs(n.x-car.x)<2.4&&Math.abs(n.z-car.z)<2.4&&Math.hypot(n.x-car.x,n.z-car.z)<2){killNpc(n,car.vx*.8,car.vz*.8,4+Math.abs(car.speed)*.2);wantedAdd(.6,1);car.speed*=.9;shakeA=Math.max(shakeA,.2)}}}

/* ================= PLAYER ================= */
function footUpdate(dt){const fx=Math.sin(camYaw),fz=Math.cos(camYaw),rx=-fz,rz=fx;
 const mx=fx*inp.y+rx*inp.x,mz=fz*inp.y+rz*inp.x,ml=Math.hypot(mx,mz),aim=inp.aim||P.aimT>0;
 const sp=ml>.05?(inp.run&&!aim?8.8:4.6)*Math.min(1,ml):0,tvx=ml>.05?mx/ml*sp:0,tvz=ml>.05?mz/ml*sp:0;
 const k=Math.min(1,dt*(P.onGround?12:3));P.vx+=(tvx-P.vx)*k;P.vz+=(tvz-P.vz)*k;
 P.x+=P.vx*dt;P.z+=P.vz*dt;P.spd=Math.hypot(P.vx,P.vz);
 if(aim)P.yaw=turnTo(P.yaw,camYaw,dt*16);else if(P.spd>.4)P.yaw=turnTo(P.yaw,Math.atan2(P.vx,P.vz),dt*10);
 const g=groundAt(P.x,P.z);
 if(P.jumpReq&&P.onGround){P.vy=6.2;P.onGround=false}P.jumpReq=false;
 P.vy-=18*dt;P.y+=P.vy*dt;if(P.y<=g){P.y=g;P.vy=0;P.onGround=true}else if(P.y-g>.25)P.onGround=false;
 collide(P,.42,P.y+.5);
 for(const c of cars){const dx=P.x-c.x,dz=P.z-c.z;if(Math.abs(dx)>3||Math.abs(dz)>3)continue;
  const fx2=Math.sin(c.yaw),fz2=Math.cos(c.yaw),lf=dx*fx2+dz*fz2,ll=-dx*fz2+dz*fx2;
  if(Math.abs(lf)<2.5&&Math.abs(ll)<1.45){const pf=2.5-Math.abs(lf),pl=1.45-Math.abs(ll);
   if(pl<pf){const s=Math.sign(ll)||1;P.x+=-fz2*s*pl;P.z+=fx2*s*pl}else{const s=Math.sign(lf)||1;P.x+=fx2*s*pf;P.z+=fz2*s*pf}
   const rel=Math.hypot(c.vx,c.vz);if(rel>7&&P.hitCD<=0){P.hitCD=1.2;damagePlayer(Math.min(40,rel*1.1));P.vx+=c.vx*.6;P.vz+=c.vz*.6;P.vy=4;P.onGround=false}}}
 bounds(P,true);P.phase+=P.spd*dt*2.4}
function driveUpdate(dt){physCar(car,inp.y,inp.x,inp.brake,dt);P.x=car.x;P.z=car.z;P.y=car.y;P.yaw=car.yaw}

/* ================= INPUT ================= */
function readInput(){const k=key;const x=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0),y=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0);
 inp.x=clamp(x+tj.x,-1,1);inp.y=clamp(y+tj.y,-1,1);inp.run=k.has('ShiftLeft')||k.has('ShiftRight')||touchRun;inp.brake=k.has('Space')||touchBrake;inp.fire=mouseDown||touchFire;inp.aim=rightDown}
function toggleCam(){mode=mode==='third'?'first':'third';camPitch=clamp(camPitch,-.9,.75);toast(mode==='third'?'Камера: от третьего лица':'Камера: от первого лица')}
function toggleRadio(){radioOn=!radioOn;if(inCar)showVeh();else toast(radioOn?'Радио включено':'Радио выключено')}
function actionCar(){if(dead||!started)return;if(inCar)exitCar();else enterCar()}
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;key.add(e.code);if(!started||paused)return;
 if(e.code==='KeyV')toggleCam();if(e.code==='KeyE'||e.code==='KeyF')actionCar();if(e.code==='Space'&&!inCar)P.jumpReq=true;if(e.code==='KeyR')reload();
 if(e.code==='KeyQ')toggleRadio();if(e.code==='KeyM'){muted=!muted;if(master)master.gain.value=muted?0:.5;toast(muted?'Звук выключен':'Звук включён')}
 if(e.code==='KeyH'){const h=$('help');h.style.opacity=h.style.opacity==='0'?1:0}});
addEventListener('keyup',e=>key.delete(e.code));
addEventListener('blur',()=>{key.clear();mouseDown=rightDown=false});
canvas.addEventListener('mousedown',e=>{if(!started||isTouch)return;if(document.pointerLockElement!==canvas){lockPointer();return}if(e.button===0)mouseDown=true;if(e.button===2)rightDown=true});
addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false;if(e.button===2)rightDown=false});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas||paused)return;const s=rightDown?.0014:.0023;camYaw-=e.movementX*s;camPitch=clamp(camPitch-e.movementY*s,mode==='first'?-1.35:-.9,mode==='first'?1.35:.75);lastMouseT=gameT});
function lockPointer(){if(!isTouch&&canvas.requestPointerLock){try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}}
document.addEventListener('pointerlockchange',()=>{if(isTouch||!started)return;paused=document.pointerLockElement!==canvas;$('pause').classList.toggle('on',paused);if(paused){key.clear();mouseDown=rightDown=false}});
$('pause').addEventListener('click',()=>lockPointer());

if(isTouch){document.body.classList.add('touch');
 const joy=$('joy'),knob=$('knob');let jid=null,jx=0,jy=0,lid=null,lx=0,ly=0;
 const moveJ=t=>{let dx=t.clientX-jx,dy=t.clientY-jy;const m=Math.hypot(dx,dy),Rr=55;if(m>Rr){dx*=Rr/m;dy*=Rr/m}knob.style.transform='translate('+dx+'px,'+dy+'px)';tj.x=dx/Rr;tj.y=-dy/Rr};
 joy.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];jid=t.identifier;const r=joy.getBoundingClientRect();jx=r.left+r.width/2;jy=r.top+r.height/2;moveJ(t)},{passive:false});
 canvas.addEventListener('touchstart',e=>{e.preventDefault();if(lid!==null)return;const t=e.changedTouches[0];lid=t.identifier;lx=t.clientX;ly=t.clientY},{passive:false});
 addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier===jid)moveJ(t);else if(t.identifier===lid){camYaw-=(t.clientX-lx)*.006;camPitch=clamp(camPitch-(t.clientY-ly)*.005,mode==='first'?-1.3:-.9,mode==='first'?1.3:.75);lx=t.clientX;ly=t.clientY;lastMouseT=gameT}}},{passive:false});
 const end=e=>{for(const t of e.changedTouches){if(t.identifier===jid){jid=null;tj.x=tj.y=0;knob.style.transform=''}if(t.identifier===lid)lid=null}};
 addEventListener('touchend',end);addEventListener('touchcancel',end);
 document.querySelectorAll('#tbtns button').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();
   if(k==='fire'){touchFire=true;if(inCar)touchBrake=true}else if(k==='jump'){if(inCar)touchBrake=true;else P.jumpReq=true}else if(k==='car')actionCar();else if(k==='cam')toggleCam();else if(k==='radio')toggleRadio();else if(k==='run'){touchRun=!touchRun;b.classList.toggle('act',touchRun)}},{passive:false});
  b.addEventListener('touchend',e=>{e.preventDefault();if(k==='fire'){touchFire=false;touchBrake=false}if(k==='jump')touchBrake=false},{passive:false})})}

/* ================= CAMERA ================= */
function camBlocked(p){return inSolid(p[0],p[1],p[2],.35)}
function computeCamera(dt){let eye,tgt,fov=1.0;const asp=canvas.width/canvas.height;
 if(!started){const a=gameT*.035;eye=[Math.sin(a)*120+20,52,Math.cos(a)*120];tgt=[20,10,0]}
 else{
  if(inCar&&mode==='third'&&gameT-lastMouseT>1.3&&Math.abs(car.speed)>2){camYaw=turnTo(camYaw,car.yaw,dt*2.2);camPitch=lerp(camPitch,0,Math.min(1,dt*1.5))}
  const fx=Math.sin(camYaw),fz=Math.cos(camYaw),rx=-fz,rz=fx;
  if(mode==='first'){const cp=Math.cos(camPitch),sp=Math.sin(camPitch);
   if(inCar){const cfx=Math.sin(car.yaw),cfz=Math.cos(car.yaw);eye=[car.x+cfx*.05+cfz*.42,car.y+1.38,car.z+cfz*.05-cfx*.42]}
   else eye=[P.x+fx*.25,P.y+1.74,P.z+fz*.25];
   tgt=[eye[0]+fx*cp*10,eye[1]+sp*10,eye[2]+fz*cp*10];if(inp.aim&&!inCar)fov=.75}
  else{const aim=!inCar&&(inp.aim||P.aimT>0);
   const dist=inCar?7.6+Math.min(Math.abs(car.speed),35)*.07:(inp.aim?3.2:aim?4.2:5.3);
   const el=clamp((inCar?.24:.18)-camPitch,-.35,1.25),side=inCar?0:(aim?.8:.55),fy=inCar?1.7:1.55;
   const fcx=P.x+rx*side,fcy=P.y+fy,fcz=P.z+rz*side;
   const at=t=>[fcx-fx*Math.cos(el)*t,fcy+Math.sin(el)*t,fcz-fz*Math.cos(el)*t];
   let d=dist;eye=at(d);for(let k=0;k<10&&camBlocked(eye);k++){d*=.8;eye=at(d)}
   const gy=groundAt(eye[0],eye[2])+.3;if(eye[1]<gy)eye[1]=gy;
   tgt=[fcx+fx*8,fcy+(.18-el)*5,fcz+fz*8];
   if(inp.aim&&!inCar)fov=.8;if(inCar)fov=1+Math.min(Math.abs(car.speed),38)*.006}}
 if(shakeA>.001){const s=shakeA*.35;eye=[eye[0]+(R()-.5)*s,eye[1]+(R()-.5)*s,eye[2]+(R()-.5)*s];shakeA*=Math.exp(-dt*7)}
 CAM.eye=eye;CAM.dir=norm([tgt[0]-eye[0],tgt[1]-eye[1],tgt[2]-eye[2]]);CAM.fov=lerp(CAM.fov,fov,Math.min(1,dt*10));
 CAM.vp=M(persp(CAM.fov,asp,.1,1400),look(eye,tgt))}

/* ================= LIGHTING ================= */
const KEYS=[
 {s:-1,top:[.012,.02,.06],hor:[.06,.08,.17],sun:[.13,.17,.32],sky:[.2,.24,.42],gnd:[.07,.07,.12]},
 {s:-.12,top:[.07,.05,.22],hor:[.55,.22,.4],sun:[.22,.14,.3],sky:[.33,.26,.5],gnd:[.13,.09,.14]},
 {s:.05,top:[.22,.28,.58],hor:[1.0,.55,.36],sun:[1.25,.66,.38],sky:[.52,.46,.62],gnd:[.26,.19,.16]},
 {s:.28,top:[.24,.5,.86],hor:[.86,.82,.78],sun:[1.1,.96,.82],sky:[.55,.62,.76],gnd:[.3,.27,.22]},
 {s:1,top:[.2,.45,.86],hor:[.72,.86,.96],sun:[1.15,1.08,.98],sky:[.55,.66,.8],gnd:[.32,.3,.26]}];
function lighting(){const a=(tod-.25)*Math.PI*2,el=Math.sin(a);let i=0;while(i<KEYS.length-2&&el>KEYS[i+1].s)i++;
 const t=clamp((el-KEYS[i].s)/(KEYS[i+1].s-KEYS[i].s),0,1),L={};for(const n of['top','hor','sun','sky','gnd'])L[n]=lerpC(KEYS[i][n],KEYS[i+1][n],t);
 const sd=norm([-Math.cos(a)*.85,Math.max(el,.06),.42]),md=norm([.35,.75,-.4]),w=smooth(-.14,.04,el);
 L.dir=norm([lerp(md[0],sd[0],w),lerp(md[1],sd[1],w),lerp(md[2],sd[2],w)]);L.el=el;L.glow=smooth(.16,-.06,el);L.night=smooth(0,-.25,el);L.fogD=lerp(.0036,.0046,L.night);
 L.disc=el>-.08?norm([-Math.cos(a)*.85,el,.42]):md;L.discCol=el>-.08?[1.4,.9,.6]:[.75,.8,.95];return L}

/* ================= RENDER ================= */
function drawChar(ch,base,phase,amp,aim,gun){const sw=Math.sin(phase)*amp;
 draw(ch.torso,base);draw(ch.head,base);
 draw(ch.leg,MM(base,T(-.19,.95,0),RX(sw)));draw(ch.leg,MM(base,T(.19,.95,0),RX(-sw)));
 draw(ch.arm,MM(base,T(.52,1.58,0),RX(-sw*.8)));
 const ra=aim?MM(base,T(-.52,1.58,0),RX(-1.5)):MM(base,T(-.52,1.58,0),RX(sw*.8));draw(ch.arm,ra);
 if(gun){draw(GUN,ra);return ra}return null}
function shadow(x,y,z,yaw,sx,sz){draw(unitMesh('#000000'),MM(T(x,y+.05,z),RY(yaw),S(sx,.005,sz)))}
function render(){const L=lighting(),vp=CAM.vp,eye=CAM.eye;
 gl.clearColor(L.hor[0],L.hor[1],L.hor[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.disable(gl.DEPTH_TEST);gl.useProgram(SK);for(let i=1;i<4;i++)gl.disableVertexAttribArray(i);
 gl.bindBuffer(gl.ARRAY_BUFFER,skyBuf);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 const hf=norm([CAM.dir[0],0,CAM.dir[2]]),hp=proj(vp,eye[0]+hf[0]*900,eye[1],eye[2]+hf[2]*900);
 const dp=proj(vp,eye[0]+L.disc[0]*900,eye[1]+L.disc[1]*900,eye[2]+L.disc[2]*900);
 gl.uniform3fv(SU.top,L.top);gl.uniform3fv(SU.hor,L.hor);gl.uniform3fv(SU.sunCol,L.discCol);gl.uniform3f(SU.sunP,dp[0],dp[1],dp[2]>0?1:0);
 gl.uniform1f(SU.hy,clamp(hp[1],-3,3));gl.uniform1f(SU.asp,canvas.width/canvas.height);gl.uniform1f(SU.night,L.night);gl.drawArrays(gl.TRIANGLES,0,3);
 gl.enable(gl.DEPTH_TEST);gl.useProgram(PR);
 gl.uniformMatrix4fv(UL.vp,false,vp);gl.uniform3fv(UL.sunDir,L.dir);gl.uniform3fv(UL.sunCol,L.sun);gl.uniform3fv(UL.ambSky,L.sky);gl.uniform3fv(UL.ambGnd,L.gnd);
 gl.uniform3fv(UL.fogCol,L.hor);gl.uniform3fv(UL.camPos,eye);gl.uniform1f(UL.fogD,L.fogD);gl.uniform1f(UL.glow,L.glow);gl.uniform1f(UL.uA,1);
 draw(world,ID);
 const vis=(x,z,r)=>{const dx=x-eye[0],dz=z-eye[2],d=Math.hypot(dx,dz);return d<r&&(d<12||(dx*CAM.dir[0]+dz*CAM.dir[2])/d>-.25)};
 for(const c of cars)if(vis(c.x,c.z,420))draw(carMeshFor(c),MM(T(c.x,c.y,c.z),RY(c.yaw)));
 for(const n of npcs){if(!vis(n.x,n.z,180))continue;const v=NPCV[n.v];
  if(n.alive)drawChar(v,MM(T(n.x,n.y+Math.abs(Math.sin(n.phase))*.05,n.z),RY(n.yaw)),n.phase,Math.min(.75,n.cur*.28),false,false);
  else drawChar(v,MM(T(n.x,n.y+.22*n.fall,n.z),RY(n.yaw),RX(-Math.PI/2*n.fall)),0,0,false,false)}
 let mz=null;
 if(!inCar&&mode!=='first'){const aim=inp.aim||P.aimT>0;mz=drawChar(HERO,MM(T(P.x,P.y+(P.onGround?Math.abs(Math.sin(P.phase))*.06:0),P.z),RY(P.yaw)),P.phase,P.onGround?Math.min(.8,P.spd*.12):.2,aim,aim)}
 if(mz)P.muzzle=[mz[4]*-1.08+mz[8]*.06+mz[12],mz[5]*-1.08+mz[9]*.06+mz[13],mz[6]*-1.08+mz[10]*.06+mz[14]];
 else P.muzzle=[eye[0]+CAM.dir[0]*.6-CAM.dir[2]*.2,eye[1]-.25,eye[2]+CAM.dir[2]*.6+CAM.dir[0]*.2];
 if(flashT>0){const m=P.muzzle;draw(unitMesh('#ffd98a',1),MM(T(m[0],m[1],m[2]),S(.12,.12,.12)))}
 for(const t of tracers){const dx=t.b[0]-t.a[0],dy=t.b[1]-t.a[1],dz=t.b[2]-t.a[2],l=Math.hypot(dx,dy,dz)||1;
  draw(unitMesh('#fff2b0',1),MM(T((t.a[0]+t.b[0])/2,(t.a[1]+t.b[1])/2,(t.a[2]+t.b[2])/2),RY(Math.atan2(dx,dz)),RX(-Math.asin(clamp(dy/l,-1,1))),S(.018,.018,l/2)))}
 for(const p of parts){if(p.kind==='smoke')continue;const f=p.life/p.max;let m,s=p.s;
  if(p.kind==='fire'){m=unitMesh(f<.35?'#ffd36b':'#ff6a1c',1);s*=1-f*.6}else if(p.kind==='spark')m=unitMesh('#ffe7a0',1);else m=unitMesh('#222222');
  draw(m,MM(T(p.x,p.y,p.z),S(s,s,s)))}
 gl.enable(gl.BLEND);gl.depthMask(false);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.uniform1f(UL.uA,.38);
 for(const c of cars)if(vis(c.x,c.z,90))shadow(c.x,c.y,c.z,c.yaw,1.2,2.35);
 for(const n of npcs)if(n.alive&&vis(n.x,n.z,60)){shadow(n.x,n.y,n.z,0,.42,.42);shadow(n.x,n.y,n.z,.785,.42,.42)}
 if(!inCar){const g=groundAt(P.x,P.z);shadow(P.x,g,P.z,0,.45,.45);shadow(P.x,g,P.z,.785,.45,.45)}
 for(const p of parts){if(p.kind!=='smoke')continue;const f=p.life/p.max,s=p.s*(1+f*2.2);gl.uniform1f(UL.uA,(1-f)*.55);draw(unitMesh('#4a4a4e'),MM(T(p.x,p.y,p.z),S(s,s,s)))}
 if(cur&&(cur.type==='goto'||cur.type==='timed')){gl.blendFunc(gl.SRC_ALPHA,gl.ONE);const g=groundAt(cur.x,cur.z),pulse=.5+.5*Math.sin(gameT*4);
  gl.uniform1f(UL.uA,.28);draw(unitMesh('#ffd45d',1),MM(T(cur.x,g+14,cur.z),S(1.6,14,1.6)));
  gl.uniform1f(UL.uA,.5+pulse*.3);draw(unitMesh('#ffd45d',1),MM(T(cur.x,g+.08,cur.z),S(3.4,.04,3.4)));
  gl.uniform1f(UL.uA,.9);draw(unitMesh('#ffd45d',1),MM(T(cur.x,g+3.2+pulse*.4,cur.z),RY(gameT*2),S(.5,.5,.5)))}
 gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(UL.uA,1)}

/* ================= MINIMAP ================= */
const mctx=$('map').getContext('2d');
function drawMap(){const c=mctx,W=240,C=120,s=1.45,k=2;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,W);c.save();c.beginPath();c.arc(C,C,C,0,6.283);c.clip();
 c.fillStyle='#1c4b63';c.fillRect(0,0,W,W);
 const fx=Math.sin(camYaw),fz=Math.cos(camYaw),rx=-fz,rz=fx,a=s*rx/k,cc=s*rz/k,b=-s*fx/k,d=-s*fz/k,pu=(P.x-MX0)*k,pv=(P.z-MZ0)*k;
 c.setTransform(a,b,cc,d,C-(a*pu+cc*pv),C-(b*pu+d*pv));c.drawImage(mapImg,0,0);c.setTransform(1,0,0,1,0,0);
 const toM=(x,z)=>{const ox=x-P.x,oz=z-P.z;return[C+s*(ox*rx+oz*rz),C-s*(ox*fx+oz*fz)]};
 const edge=(p,r)=>{const dx=p[0]-C,dy=p[1]-C,l=Math.hypot(dx,dy);return l>r?[C+dx/l*r,C+dy/l*r]:p};
 for(const q of cars)if(q.police&&!q.burnt){const p=edge(toM(q.x,q.z),C-8);c.fillStyle=Math.floor(gameT*6)%2?'#ff3344':'#3a7bff';c.beginPath();c.arc(p[0],p[1],5,0,6.283);c.fill()}
 if(cur&&(cur.type==='goto'||cur.type==='timed')){const p=edge(toM(cur.x,cur.z),C-10);c.fillStyle='#ffd45d';c.strokeStyle='#000';c.lineWidth=2;c.beginPath();c.arc(p[0],p[1],7,0,6.283);c.fill();c.stroke()}
 const hx=Math.sin(P.yaw),hz=Math.cos(P.yaw),ang=Math.atan2(-(hx*fx+hz*fz),hx*rx+hz*rz);
 c.translate(C,C);c.rotate(ang);c.fillStyle='#fff';c.strokeStyle='#000';c.lineWidth=2;c.beginPath();c.moveTo(10,0);c.lineTo(-6,6);c.lineTo(-3,0);c.lineTo(-6,-6);c.closePath();c.fill();c.stroke();c.setTransform(1,0,0,1,0,0);
 const np=[C+rz*(C-12),C-fz*(C-12)];c.fillStyle='#fff';c.font='bold 13px Rubik,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('N',np[0],np[1]);
 c.restore()}

/* ================= HUD ================= */
let hudT=0;
function hud(dt){dispCash=lerp(dispCash,cash,Math.min(1,dt*6));if(Math.abs(dispCash-cash)<1)dispCash=cash;setT('cash',fmt(dispCash));
 const h=Math.floor(tod*24),m=Math.floor((tod*24-h)*60);setT('clock',String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'));
 const st=Math.ceil(wanted-1e-6),si=$('stars').children;for(let i=0;i<5;i++)si[i].classList.toggle('on',i<st);
 const am=(reloadT>0?'…':ammo)+'<small>/'+reserve+'</small>';if(hc.ammo!==am){hc.ammo=am;$('ammo').innerHTML=am}
 $('hpb').style.width=P.hp+'%';$('armb').style.width=P.arm*2+'%';$('hpb').parentNode.classList.toggle('low',P.hp<25);
 const cr=$('cross');cr.classList.toggle('off',inCar||dead);cr.classList.toggle('aim',inp.aim);cr.classList.toggle('hit',hitT>0);
 let pr='';if(!inCar&&!dead){for(const c of cars)if(!c.burnt&&Math.hypot(c.x-P.x,c.z-P.z)<3.6){pr=isTouch?'Нажмите «Авто», чтобы сесть':'<kbd>E</kbd>Сесть в '+CT[c.type].name;break}}
 const pe=$('prompt');if(hc.prompt!==pr){hc.prompt=pr;pe.innerHTML=pr;pe.style.display=pr?'block':'none'}
 hudT+=dt;if(hudT>.5){hudT=0;const z=zoneName(P.x,P.z);if(z!==curZone){curZone=z;const e=$('zone');e.textContent=z;e.classList.add('on');clearTimeout(zoneTO);zoneTO=setTimeout(()=>e.classList.remove('on'),3000)}}}

/* ================= LOOP ================= */
function audioUpdate(){if(!AC)return;const t=AC.currentTime,on=inCar&&!muted&&!dead;
 engG.gain.setTargetAtTime(on?.06+Math.min(Math.abs(car.speed),35)*.0022:0,t,.08);if(car){engO.frequency.setTargetAtTime(38+Math.abs(car.speed)*4.2+(inp.y>0?12:0),t,.05);engF.frequency.setTargetAtTime(300+Math.abs(car.speed)*30,t,.05)}
 const r=on&&radioOn;radioG.gain.setTargetAtTime(r?.5:0,t,.3);radioTick(r)}
function update(dt){gameT+=dt;
 if(!started){tod=(tod+dt/DAY*.5)%1;return}
 tod=(tod+dt/DAY)%1;readInput();
 fireCD-=dt;flashT-=dt;hitT-=dt;P.aimT-=dt;P.hitCD-=dt;
 if(reloadT>0){reloadT-=dt;if(reloadT<=0){const n=Math.min(18-ammo,reserve);ammo+=n;reserve-=n}}
 if(dead){deadT-=dt;if(deadT<=0)respawn()}
 else if(inCar)driveUpdate(dt);else{footUpdate(dt);if(inp.fire)shoot()}
 carsUpdate(dt);npcUpdate(dt);policeUpdate(dt);
 for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life+=dt;if(p.life>p.max){parts.splice(i,1);continue}
  const g=p.kind==='debris'||p.kind==='spark'?14:p.kind==='fire'?-2:-.6;p.vy-=g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.kind==='debris'&&p.y<.1){p.y=.1;p.vy*=-.3;p.vx*=.7;p.vz*=.7}}
 for(let i=tracers.length-1;i>=0;i--){tracers[i].t-=dt;if(tracers[i].t<=0)tracers.splice(i,1)}
 missionUpdate(dt);audioUpdate();hud(dt)}
let last=0,errShown=false;
function loop(t){const dt=Math.min(.05,Math.max(0,(t-last)/1000)||.016);last=t;
 try{if(!paused)update(dt);computeCamera(dt);render();if(started)drawMap()}catch(err){if(!errShown){errShown=true;console.error(err)}}
 requestAnimationFrame(loop)}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,isTouch?1.5:1.75);canvas.width=Math.max(1,Math.floor(innerWidth*dpr));canvas.height=Math.max(1,Math.floor(innerHeight*dpr));gl.viewport(0,0,canvas.width,canvas.height)}
addEventListener('resize',resize);resize();

/* ================= BOOT ================= */
function boot(){
 try{
  world=buildWorld();mapImg=buildMap();
  for(let i=0;i<40;i++){const c=newCar({});if(placeTraffic(c,25))cars.push(c)}
  for(const s of parkSpots){if(R()<.8)cars.push(newCar({x:s.x,z:s.z,yaw:s.yaw,type:randType(),color:pick(CARCOL),parked:true}))}
  cars.push(newCar({x:6,z:-14.8,yaw:Math.PI/2,type:'sport',color:'#e36b9c',parked:true}));
  cars.push(newCar({x:-7,z:-14.8,yaw:Math.PI/2,type:'suv',color:'#23a9a0',parked:true}));
  for(let i=0;i<72;i++){const n={v:i%NPCV.length,free:i>=58};placeNpc(n,8);npcs.push(n)}
 }catch(err){fatal('Ошибка загрузки мира: '+err.message);console.error(err);return}
 ready=true;$('loadText').textContent='Город готов';const b=$('play');b.disabled=false;b.textContent='Играть';try{b.focus()}catch(e){}requestAnimationFrame(loop)}
$('play').addEventListener('click',()=>{if(!ready||started)return;initAudio();started=true;$('start').classList.add('hide');$('hud').classList.add('on');document.body.classList.add('playing');
 lockPointer();setTimeout(()=>{$('start').style.display='none'},700);banner('Vice District','Добро пожаловать в город');curZone='';
 setTimeout(()=>{$('help').style.opacity=0},16000)});
setTimeout(()=>{$('loadText').textContent='Прокладываем улицы и сажаем пальмы…';setTimeout(boot,60)},60);
})();
