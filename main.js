import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const scene=new THREE.Scene();scene.background=new THREE.Color(0x86a7b9);scene.fog=new THREE.Fog(0x86a7b9,100,450);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,700);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdff4ff,0x263126,2));const sun=new THREE.DirectionalLight(0xfff0d2,3);sun.position.set(-100,180,70);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);

const keys={},remote=new Map(),vehicles=[];let id=null,self=null,yaw=0,pitch=-.16,mouse=false,vehicle=null,lastShot=0,connected=false;
const player=new THREE.Group();scene.add(player);
function M(c,r=.65,m=0){return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m})}
function cube(w,h,d,c,x,y,z,p=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m}
function modelPerson(c){const g=new THREE.Group();const body=cube(.75,1.1,.45,c,0,1.25,0,g);const head=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),M(0xd0a07c));head.position.y=2.05;head.castShadow=true;g.add(head);cube(.18,.85,.18,0x222222,-.22,.45,0,g);cube(.18,.85,.18,0x222222,.22,.45,0,g);return g}
player.add(modelPerson(0xe4e4e4));player.position.set(0,0,30);

function road(x,z,w,d){cube(w,.04,d,0x1b1e21,x,.02,z);if(w>d)for(let i=-w/2+6;i<w/2;i+=14)cube(3,.05,.18,0xc7bf8d,x+i,.05,z);else for(let i=-d/2+6;i<d/2;i+=14)cube(.18,.05,3,0xc7bf8d,x,.05,z+i)}
function building(x,z,w,d,h,c){cube(w,h,d,c,x,h/2,z);for(let yy=2;yy<h-1;yy+=3)for(let xx=-w/2+2;xx<w/2-1;xx+=3)cube(.9,.9,.06,0x86adb4,x+xx,yy,z-d/2-.04)}
function tree(x,z){cube(.65,3,.65,0x65462f,x,1.5,z);const m=new THREE.Mesh(new THREE.SphereGeometry(2.7,10,8),M(0x2b5b32));m.position.set(x,4,z);m.castShadow=true;scene.add(m)}
cube(520,.5,520,0x3a433d,0,-.3,0);for(let p=-240;p<=240;p+=60){road(p,0,18,520);road(0,p,520,18)}
for(let x=-210;x<=210;x+=30)for(let z=-210;z<=210;z+=30){if(Math.abs(x)%60<20||Math.abs(z)%60<20)continue;building(x,z,18+Math.random()*8,18+Math.random()*8,8+Math.random()*32,[0x586168,0x6a625b,0x4d5e5e,0x765f50][Math.floor(Math.random()*4)]);if(Math.random()<.25)tree(x+12,z+11)}
cube(40,.3,40,0x5d1820,-120,.15,120);cube(40,.3,40,0x173f67,120,.15,-120);

function makeCar(x,z,c){const g=new THREE.Group();g.position.set(x,.8,z);cube(2.4,.55,4.3,c,0,0,0,g);cube(1.75,.7,2,0x172027,0,.58,-.1,g);for(const sx of[-1,1])for(const sz of[-1,1]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.3,14),M(0x111));w.rotation.z=Math.PI/2;w.position.set(sx*1.12,.02,sz*1.45);g.add(w)}scene.add(g);vehicles.push({g,speed:0,heading:0})}
for(let i=0;i<14;i++)makeCar((i%7-3)*34,(Math.floor(i/7)-.5)*100,[0xd44d4d,0x377fbe,0xd0a53d][i%3]);

function addRemote(p){if(p.id===id)return;let old=remote.get(p.id);if(!old){const g=new THREE.Group();g.add(modelPerson(p.team==="RED"?0xd94750:0x4289d1));scene.add(g);old={g,data:p};remote.set(p.id,old)}old.data=p;old.g.position.set(p.x,p.y,p.z)}
function removeRemote(pid){const r=remote.get(pid);if(r){scene.remove(r.g);remote.delete(pid)}}
function updateBoard(list){rows.innerHTML=list.map(p=>`<div class="row"><span class="${p.team.toLowerCase()}">${p.name}</span><span>${p.team}</span><span>${p.hp} HP</span></div>`).join("")}

let socket;function connect(){const proto=location.protocol==="https:"?"wss":"ws";const host=location.host;socket=new WebSocket(`${proto}://${host}`);socket.onopen=()=>{connected=true;net.textContent="ONLINE";toast.textContent="Онлайн-сервер подключён"};socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="welcome"){id=m.id;self=m.player;player.position.set(self.x,self.y,self.z);team.innerHTML=`<span class="${self.team.toLowerCase()}">${self.team}</span>`;m.players.forEach(addRemote);updateBoard(m.players);load.style.display="none"}if(m.type==="join"){addRemote(m.player)}if(m.type==="leave"){removeRemote(m.id)}if(m.type==="state"){addRemote(m.player)}if(m.type==="damage"&&m.target===id){hp.textContent=m.hp;self.hp=m.hp}if(m.type==="respawn"&&m.player.id===id){self=m.player;player.position.set(self.x,self.y,self.z);hp.textContent=100;toast.textContent="Респавн"}};socket.onclose=()=>{connected=false;net.textContent="OFFLINE";toast.textContent="Сервер отключён"}}connect();

function sendState(){if(connected&&socket.readyState===1)socket.send(JSON.stringify({type:"state",x:player.position.x,y:player.position.y,z:player.position.z,ry:yaw,vehicle:vehicle?"car":null}))}
function nearest(){let b=null,d=6;for(const v of vehicles){const q=v.g.position.distanceTo(player.position);if(q<d){d=q;b=v}}return b}
function interact(){if(vehicle){player.visible=true;player.position.copy(vehicle.g.position).add(new THREE.Vector3(0,1,0));vehicle=null;return}const v=nearest();if(v){vehicle=v;player.visible=false}}
function shoot(){if(!connected||performance.now()-lastShot<170)return;lastShot=performance.now();const origin=player.position.clone();origin.y+=1.5;const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch,yaw,0,"YXZ"));const ray=new THREE.Raycaster(origin,dir,0,150);for(const [pid,r] of remote){const hits=ray.intersectObject(r.g,true);if(hits.length){socket.send(JSON.stringify({type:"hit",target:pid,damage:25}));break}}}
function move(dt){if(vehicle){let v=vehicle;let accel=(keys.KeyW?1:0)-(keys.KeyS?1:0);v.speed+=accel*24*dt;v.speed*=Math.pow(.2,dt);if(keys.KeyA)v.heading+=2*dt;if(keys.KeyD)v.heading-=2*dt;v.g.rotation.y=v.heading;v.g.position.add(new THREE.Vector3(Math.sin(v.heading),0,Math.cos(v.heading)).multiplyScalar(v.speed*dt));if(keys.Space)v.g.position.y+=13*dt;else v.g.position.y=Math.max(.8,v.g.position.y-9*dt);player.position.copy(v.g.position);return}
let sp=(keys.ShiftLeft||keys.ShiftRight?10:6)*(keys.ControlLeft||keys.ControlRight?.5:1),f=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),m=new THREE.Vector3();if(keys.KeyW)m.add(f.clone().multiplyScalar(-1));if(keys.KeyS)m.add(f);if(keys.KeyA)m.add(r.clone().multiplyScalar(-1));if(keys.KeyD)m.add(r);if(m.lengthSq())m.normalize().multiplyScalar(sp*dt);player.position.add(m);player.position.y=1;self&&(self.x=player.position.x,self.y=1,self.z=player.position.z)}
function cam(){const t=vehicle?vehicle.g:player,off=new THREE.Vector3(0,vehicle?4:2.8,vehicle?9:7).applyEuler(new THREE.Euler(0,yaw,0));camera.position.lerp(t.position.clone().add(off),.13);camera.lookAt(t.position.clone().add(new THREE.Vector3(0,.8,0)))}
addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Tab"){e.preventDefault();board.classList.toggle("hide");if(connected)socket.send(JSON.stringify({type:"state",x:player.position.x,y:player.position.y,z:player.position.z,ry:yaw}))}if(e.code==="KeyE"||e.code==="KeyF")interact()});addEventListener("keyup",e=>keys[e.code]=false);
addEventListener("mousedown",()=>{mouse=true;renderer.domElement.requestPointerLock()});addEventListener("mouseup",()=>mouse=false);addEventListener("mousemove",e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.2,Math.min(.6,pitch))}});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
const clock=new THREE.Clock();let tick=0;function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.033);move(dt);if(mouse&&!vehicle)shoot();cam();if(++tick%5===0)sendState();for(const r of remote.values())r.g.position.lerp(new THREE.Vector3(r.data.x,r.data.y,r.data.z),.35);renderer.render(scene,camera)}loop();