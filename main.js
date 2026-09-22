import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("game");
const loading = document.getElementById("loading");
const loadingStatus = document.getElementById("loadingStatus");
const hpEl = document.getElementById("hp");
const armorEl = document.getElementById("armor");
const cashEl = document.getElementById("cash");
const wantedEl = document.getElementById("wanted");
const ammoEl = document.getElementById("ammo");
const toastEl = document.getElementById("toast");
const vehiclePrompt = document.getElementById("vehiclePrompt");
const scoreboard = document.getElementById("scoreboard");
const missionText = document.getElementById("missionText");
const damageEl = document.getElementById("damage");
const mapCanvas = document.getElementById("map");
const mapCtx = mapCanvas.getContext("2d");

let scene, camera, renderer, clock;
let player, playerBody, weapon, vehicle = null;
let inVehicle = false, crouched = false, jumping = false;
let hp=100, armor=50, cash=2450, ammo=18, wanted=0;
let missionProgress=0, fireCooldown=0, damageCooldown=0;
const keys = new Set();
const bullets=[], npcs=[], cars=[], buildings=[], particles=[];
const WORLD=520, ROAD=18, BLOCK=52;
const target = new THREE.Vector3(120,0,120);
const tmp = new THREE.Vector3();

function mat(color, rough=0.7, metal=0){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
}
function box(w,h,d,m,x=0,y=0,z=0){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return o;
}
function cyl(r,h,m,x=0,y=0,z=0){
  const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),m);
  o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; return o;
}
function toast(t,ms=1800){
  toastEl.textContent=t; toastEl.classList.remove("toast-hide"); toastEl.classList.add("toast-show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>toastEl.classList.add("toast-hide"),ms);
}
function setStatus(t){ loadingStatus.textContent=t; }

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x071018);
  scene.fog=new THREE.FogExp2(0x071018,0.0027);

  camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,900);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  clock=new THREE.Clock();

  const hemi=new THREE.HemisphereLight(0x9ec8ff,0x18211d,1.55); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe4c1,2.7);
  sun.position.set(-120,180,80); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-220; sun.shadow.camera.right=220; sun.shadow.camera.top=220; sun.shadow.camera.bottom=-220;
  scene.add(sun);

  buildCity();
  buildPlayer();
  buildCars();
  buildNPCs();
  setupInput();
  resize();

  setStatus("Загрузка города…");
  setTimeout(()=>setStatus("Генерация транспорта и NPC…"),350);
  setTimeout(()=>setStatus("Синхронизация мира…"),750);
  setTimeout(()=>{ loading.style.opacity="0"; setTimeout(()=>loading.remove(),700); toast("ГОРОД ЗАГРУЖЕН — ДОБРО ПОЖАЛОВАТЬ В VICE DISTRICT",2600); },1200);

  animate();
}

function buildCity(){
  const ground=box(WORLD,.6,WORLD,mat(0x18221f),0,-.3,0); scene.add(ground);
  const asphalt=mat(0x20262a), sidewalk=mat(0x77746c), concrete=mat(0x525b60);
  for(let x=-WORLD/2;x<=WORLD/2;x+=BLOCK){
    scene.add(box(ROAD,.08,WORLD,asphalt,x,.02,0));
    scene.add(box(1.8,.12,WORLD,sidewalk,x-ROAD/2-1,.05,0));
    scene.add(box(1.8,.12,WORLD,sidewalk,x+ROAD/2+1,.05,0));
  }
  for(let z=-WORLD/2;z<=WORLD/2;z+=BLOCK){
    scene.add(box(WORLD,.08,ROAD,asphalt,0,.03,z));
    scene.add(box(WORLD,.12,1.8,sidewalk,0,.05,z-ROAD/2-1));
    scene.add(box(WORLD,.12,1.8,sidewalk,0,.05,z+ROAD/2+1));
  }
  const line=mat(0xd9c86a,.5);
  for(let x=-WORLD/2;x<WORLD/2;x+=BLOCK) for(let z=-WORLD/2;z<WORLD/2;z+=BLOCK){
    for(let k=-4;k<=4;k++) scene.add(box(.18,.015,3,line,x+k*2.2,.08,z));
  }
  for(let x=-WORLD/2+ROAD+8;x<WORLD/2-ROAD;x+=BLOCK){
    for(let z=-WORLD/2+ROAD+8;z<WORLD/2-ROAD;z+=BLOCK){
      if(Math.random()<.12) continue;
      const w=24+Math.random()*20,d=24+Math.random()*20,h=12+Math.random()*55;
      const colors=[0x26343d,0x3d4850,0x5a5350,0x35433f,0x4b4654];
      const b=box(w,h,d,mat(colors[Math.floor(Math.random()*colors.length)]),x,y=h/2,z);
      scene.add(b); buildings.push(b);
      const windowMat=mat(0x9cc7d8,.25,.1);
      const rows=Math.min(8,Math.floor(h/7));
      for(let r=0;r<rows;r++){
        for(let c=-2;c<=2;c++){
          if(Math.random()<.2) continue;
          const win=box(1.6,2.3,.08,windowMat,x+c*4,h/2-4-r*6,z-d/2-.05);
          scene.add(win);
        }
      }
    }
  }
  // Waterfront
  const water= new THREE.Mesh(new THREE.PlaneGeometry(180,120),new THREE.MeshStandardMaterial({color:0x12394a,roughness:.08,metalness:.45,transparent:true,opacity:.9}));
  water.rotation.x=-Math.PI/2; water.position.set(170,-.05,-150); scene.add(water);
  // Palm-like trees and street lamps
  for(let i=0;i<90;i++){
    const x=(Math.random()-.5)*WORLD, z=(Math.random()-.5)*WORLD;
    if(Math.abs(x%BLOCK)<15 || Math.abs(z%BLOCK)<15) continue;
    if(x>80&&z<-80) continue;
    const trunk=cyl(.35,6,mat(0x5a3e2d),x,3,z); scene.add(trunk);
    const crown=new THREE.Group();
    for(let a=0;a<7;a++){ const leaf=box(.28,3.8,.8,mat(0x294c37),0,0,0); leaf.position.set(Math.cos(a*Math.PI*2/7)*1.4,0,Math.sin(a*Math.PI*2/7)*1.4); leaf.rotation.y=a*Math.PI*2/7; leaf.rotation.z=.35; crown.add(leaf);}
    crown.position.set(x,6,z); scene.add(crown);
  }
}

function buildPlayer(){
  player=new THREE.Group();
  player.position.set(0,0,18);
  playerBody=box(1.1,1.8,.65,mat(0x17212b),0,1,0); player.add(playerBody);
  const head=cyl(.34,.5,mat(0xc68f6c),0,2.18,0); player.add(head);
  const jacket=box(1.18,.85,.7,mat(0x2d3f52),0,1.25,0); player.add(jacket);
  weapon=box(.12,.12,.9,mat(0x16191c,.3,.8),.55,1.3,-.2); weapon.rotation.x=.08; player.add(weapon);
  scene.add(player);
}

function createCar(x,z,color,rot=0){
  const g=new THREE.Group();
  const body=box(3.2,.75,6,mat(color,.38,.55),0,.8,0); g.add(body);
  const cabin=box(2.65,.85,2.8,mat(0x172027,.18,.65),0,1.45,-.25); g.add(cabin);
  const bumper=box(3.05,.18,.25,mat(0x101417,.25,.7),0,.55,2.9); g.add(bumper);
  const wheelMat=mat(0x0b0d0f,.25,.8);
  for(const sx of [-1.7,1.7]) for(const sz of [-2.05,2.05]){
    const w=cyl(.52,.32,wheelMat,sx,0.5,sz); w.rotation.z=Math.PI/2; g.add(w);
  }
  g.position.set(x,0,z); g.rotation.y=rot; g.userData.speed=0; g.userData.dir=new THREE.Vector3(Math.sin(rot),0,Math.cos(rot));
  scene.add(g); cars.push(g); return g;
}
function buildCars(){
  const colors=[0x8e2931,0x263d63,0xc7a52f,0x1e6a63,0xaaa8a0,0x4c2b65];
  for(let i=0;i<34;i++){
    const horizontal=Math.random()<.5;
    const road=Math.round((Math.random()-.5)*9)*BLOCK;
    const along=(Math.random()-.5)*WORLD;
    createCar(horizontal?along:road, horizontal?road:along, colors[i%colors.length], horizontal?(Math.random()<.5?0:Math.PI):Math.PI/2*(Math.random()<.5?1:-1));
  }
}
function createNPC(x,z){
  const g=new THREE.Group();
  g.position.set(x,0,z);
  const body=box(.7,1.3,.45,mat([0x324d6a,0x6a3b32,0x3e5942,0x6b5d36][Math.floor(Math.random()*4)]),0,.75,0); g.add(body);
  g.add(cyl(.24,.4,mat(0xb77d5c),0,1.62,0));
  g.userData.vel=new THREE.Vector3((Math.random()-.5)*.35,0,(Math.random()-.5)*.35);
  g.userData.timer=Math.random()*4;
  scene.add(g); npcs.push(g);
}
function buildNPCs(){
  for(let i=0;i<42;i++) createNPC((Math.random()-.5)*WORLD,(Math.random()-.5)*WORLD);
}

function setupInput(){
  addEventListener("keydown",e=>{
    keys.add(e.code);
    if(e.code==="Tab"){e.preventDefault();scoreboard.classList.toggle("hidden");}
    if(e.code==="KeyE") enterVehicle();
    if(e.code==="KeyF") exitVehicle();
    if(e.code==="ControlLeft"||e.code==="ControlRight"){crouched=true; player.scale.y=.72;}
    if(e.code==="Space" && !jumping && !inVehicle){jumping=true;}
  });
  addEventListener("keyup",e=>{
    keys.delete(e.code);
    if(e.code==="ControlLeft"||e.code==="ControlRight"){crouched=false; player.scale.y=1;}
  });
  addEventListener("mousedown",e=>{ if(e.button===0) shoot(); });
  addEventListener("resize",resize);
}
function enterVehicle(){
  if(inVehicle) return;
  let nearest=null,dist=4;
  for(const c of cars){const d=c.position.distanceTo(player.position);if(d<dist){nearest=c;dist=d;}}
  if(!nearest){toast("Подойдите ближе к автомобилю");return;}
  vehicle=nearest; inVehicle=true; vehiclePrompt.classList.add("hidden"); toast("АВТОМОБИЛЬ: УПРАВЛЕНИЕ АКТИВНО");
}
function exitVehicle(){
  if(!inVehicle) return;
  player.position.copy(vehicle.position).add(new THREE.Vector3(3,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),vehicle.rotation.y));
  inVehicle=false; vehicle=null; toast("ВЫ ВЫШЛИ ИЗ АВТОМОБИЛЯ");
}
function shoot(){
  if(inVehicle||fireCooldown>0||ammo<=0) return;
  ammo--; ammoEl.textContent=ammo; fireCooldown=.12; wanted=Math.min(5,wanted+0.03);
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  const start=player.position.clone().add(new THREE.Vector3(0,1.35,0)).add(dir.clone().multiplyScalar(1.1));
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(.055,6,6),mat(0xffd36b,.25,.6)); mesh.position.copy(start); scene.add(mesh);
  bullets.push({mesh,vel:dir.multiplyScalar(85),life:1.5});
  for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.025,4,4),mat(0xffb347));p.position.copy(start);scene.add(p);particles.push({mesh:p,vel:dir.clone().multiplyScalar(8).add(new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3)),life:.25});}
  if(ammo===0){toast("ПЕРЕЗАРЯДКА"); setTimeout(()=>{ammo=18;ammoEl.textContent=ammo},900);}
}
function updatePlayer(dt){
  if(inVehicle){
    const accel=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0);
    const steer=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
    vehicle.userData.speed += accel*18*dt;
    vehicle.userData.speed *= Math.pow(.985,dt*60);
    vehicle.userData.speed=THREE.MathUtils.clamp(vehicle.userData.speed,-15,32);
    vehicle.rotation.y += steer*dt*(.75+Math.abs(vehicle.userData.speed)/30);
    const dir=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y));
    vehicle.position.addScaledVector(dir,vehicle.userData.speed*dt);
    vehicle.position.x=THREE.MathUtils.clamp(vehicle.position.x,-WORLD/2+8,WORLD/2-8);
    vehicle.position.z=THREE.MathUtils.clamp(vehicle.position.z,-WORLD/2+8,WORLD/2-8);
    player.position.copy(vehicle.position); return;
  }
  const f=new THREE.Vector3((keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0),0,(keys.has("KeyS")?1:0)-(keys.has("KeyW")?1:0));
  if(f.lengthSq()>0) f.normalize();
  const speed=keys.has("ShiftLeft")||keys.has("ShiftRight")?8.5:4.8;
  player.position.addScaledVector(f,speed*dt);
  if(f.lengthSq()>0) player.rotation.y=Math.atan2(f.x,f.z);
  player.position.x=THREE.MathUtils.clamp(player.position.x,-WORLD/2+5,WORLD/2-5);
  player.position.z=THREE.MathUtils.clamp(player.position.z,-WORLD/2+5,WORLD/2-5);
  if(jumping){player.position.y+=7*dt;if(player.position.y>1.9){player.position.y=1.9;jumping=false}}
  else if(player.position.y>0) player.position.y=Math.max(0,player.position.y-10*dt);
}
function updateNPCs(dt){
  for(const n of npcs){
    n.userData.timer-=dt;
    if(n.userData.timer<0){n.userData.timer=1+Math.random()*3;n.userData.vel.set((Math.random()-.5)*.4,0,(Math.random()-.5)*.4);}
    n.position.addScaledVector(n.userData.vel,dt);
    if(Math.abs(n.position.x)>WORLD/2||Math.abs(n.position.z)>WORLD/2)n.userData.vel.multiplyScalar(-1);
  }
}
function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i]; b.mesh.position.addScaledVector(b.vel,dt); b.life-=dt;
    let hit=false;
    for(const n of npcs){if(b.mesh.position.distanceTo(n.position.clone().add(new THREE.Vector3(0,1,0)))<.65){hit=true;scene.remove(n);npcs.splice(npcs.indexOf(n),1);cash+=50;cashEl.textContent="$"+cash.toLocaleString();break;}}
    if(b.life<=0||hit){scene.remove(b.mesh);bullets.splice(i,1);}
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.mesh.position.addScaledVector(p.vel,dt);p.life-=dt;if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);}}
}
function updateCamera(dt){
  const focus=inVehicle?vehicle.position:player.position;
  const yaw=player.rotation.y;
  const desired=new THREE.Vector3(Math.sin(yaw)*6,3.6,Math.cos(yaw)*6).add(focus);
  camera.position.lerp(desired,1-Math.pow(.001,dt));
  camera.lookAt(focus.x,focus.y+(inVehicle?1.2:1.35),focus.z);
}
function updateUI(){
  hpEl.textContent=Math.max(0,Math.round(hp)); armorEl.textContent=Math.max(0,Math.round(armor)); wantedEl.textContent="★".repeat(Math.ceil(wanted))+"☆".repeat(5-Math.ceil(wanted));
  const near=cars.some(c=>c.position.distanceTo(player.position)<4);
  if(near&&!inVehicle) vehiclePrompt.classList.remove("hidden"); else vehiclePrompt.classList.add("hidden");
  missionProgress=Math.min(100,missionProgress+0.015); document.getElementById("missionProgress").style.width=missionProgress+"%";
  if(missionProgress>=100){missionProgress=0;cash+=500;cashEl.textContent="$"+cash.toLocaleString();toast("ЦЕЛЬ ВЫПОЛНЕНА  +$500");target.set((Math.random()-.5)*220,0,(Math.random()-.5)*220);}
}
function drawMap(){
  const c=mapCtx,w=190,h=190;c.clearRect(0,0,w,h);
  c.fillStyle="#0b1319";c.fillRect(0,0,w,h);
  c.strokeStyle="#34414a";c.lineWidth=5;
  for(let x=10;x<w;x+=20){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
  for(let y=10;y<h;y+=20){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  const px=(player.position.x/WORLD+.5)*w,pz=(player.position.z/WORLD+.5)*h;
  c.fillStyle="#7fc8ff";c.beginPath();c.arc(px,pz,4,0,Math.PI*2);c.fill();
  c.fillStyle="#ffcf66";const tx=(target.x/WORLD+.5)*w,tz=(target.z/WORLD+.5)*h;c.beginPath();c.arc(tx,tz,3,0,Math.PI*2);c.fill();
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);
  fireCooldown=Math.max(0,fireCooldown-dt);
  damageCooldown=Math.max(0,damageCooldown-dt);
  updatePlayer(dt); updateNPCs(dt); updateBullets(dt); updateParticles(dt); updateCamera(dt); updateUI(); drawMap();
  // Ambient vehicle movement for cars not controlled by player.
  for(const c of cars){if(c===vehicle)continue;c.userData.speed=2.5;c.position.addScaledVector(c.userData.dir,dt*2.5);if(Math.abs(c.position.x)>WORLD/2||Math.abs(c.position.z)>WORLD/2)c.userData.dir.multiplyScalar(-1);}
  renderer.render(scene,camera);
}
init();
