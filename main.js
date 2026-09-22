import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fa1b9);
scene.fog = new THREE.Fog(0x7fa1b9, 80, 320);

const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, .1, 500);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdbeeff,0x334433,2));
const sun = new THREE.DirectionalLight(0xffffff,2.2);
sun.position.set(80,130,50); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
scene.add(sun);

const keys = {};
let mouseDown=false, yaw=0, pitch=-0.18, score={red:0,blue:0};
let crouch=false, sprint=false, vehicle=null, flying=false, lastShot=0;

const player = new THREE.Group();
player.position.set(0,1.1,35);
scene.add(player);

const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42,.9,4,8), new THREE.MeshStandardMaterial({color:0xdddddd}));
body.castShadow=true; body.position.y=0;
player.add(body);

function box(w,h,d,c,x,y,z,group=scene){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c}));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
}
function makeCity(){
  const ground=box(420,.5,420,0x303936,0,-.35,0);
  for(let x=-180;x<=180;x+=30) for(let z=-180;z<=180;z+=30){
    if(Math.random()<.72){
      const w=12+Math.random()*10,d=12+Math.random()*10,h=5+Math.random()*35;
      box(w,h,d,0x50565c,x,h/2,z);
      if(Math.random()<.35) box(w+.2,.35,d+.2,0x3c4145,x,h+.18,z);
    }
  }
  // Roads
  for(let p=-180;p<=180;p+=60){
    box(22,.05,420,0x171a1c,p,-.06,0);
    box(420,.05,22,0x171a1c,0,-.05,p);
  }
  // Team bases
  const redBase=box(34,.2,34,0x5a171d,-120,.08,120);
  const blueBase=box(34,.2,34,0x173d63,120,.08,-120);
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    box(.4,3,.4,0xff4b55,-120+Math.cos(a)*14,1.5,120+Math.sin(a)*14);
    box(.4,3,.4,0x57a7ff,120+Math.cos(a)*14,1.5,-120+Math.sin(a)*14);
  }
}
makeCity();

const vehicles=[];
function makeCar(x,z,color){
  const g=new THREE.Group(); g.position.set(x,.8,z);
  const chassis=box(2.3,.55,4.2,color,0,0,0,g);
  box(1.7,.65,1.9,0x1d2328,0,.55,-.15,g);
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.28,12),new THREE.MeshStandardMaterial({color:0x101010}));
    w.rotation.z=Math.PI/2; w.position.set(sx*1.12,.05,sz*1.45); w.castShadow=true; g.add(w);
  }
  scene.add(g); vehicles.push({g,speed:0,heading:0});
}
for(let i=0;i<8;i++) makeCar((i%4-1.5)*55, (Math.floor(i/4)*2-1)*55, i%2?0x2d79bd:0xc23d45);

function nearestVehicle(){
  let best=null,bd=5;
  for(const v of vehicles){const d=v.g.position.distanceTo(player.position);if(d<bd){bd=d;best=v;}}
  return best;
}
function enterExit(){
  if(vehicle){player.visible=true; player.position.copy(vehicle.g.position).add(new THREE.Vector3(0,1.3,0)); vehicle=null; status("Вышел из транспорта"); return;}
  const v=nearestVehicle();
  if(v){vehicle=v;player.visible=false;status("Управление транспортом: WASD · SPACE — взлёт");}
}
function status(t){document.getElementById("status").textContent=t}

function shoot(){
  if(performance.now()-lastShot<180)return; lastShot=performance.now();
  const origin=new THREE.Vector3(); player.getWorldPosition(origin); origin.y+=.4;
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(pitch,yaw,0,"YXZ")).normalize();
  const ray=new THREE.Raycaster(origin,dir,0,120);
  const targets=scene.children.filter(o=>o.userData.enemy);
  const hit=ray.intersectObjects(targets,true)[0];
  if(hit){hit.object.material.color.offsetHSL(0,-.2,-.1); score.red++; updateScore();}
}
function spawnEnemies(){
  for(let i=0;i<12;i++){
    const g=new THREE.Group();
    g.position.set((Math.random()-.5)*300,1.1,(Math.random()-.5)*300);
    if(g.position.distanceTo(player.position)<30){i--;continue}
    const m=new THREE.Mesh(new THREE.CapsuleGeometry(.4,.9,4,8),new THREE.MeshStandardMaterial({color:0x4c8ed8}));
    m.userData.enemy=true;m.castShadow=true;g.add(m);scene.add(g);
    g.userData.enemy=true;
  }
}
spawnEnemies();

function updateScore(){
  redScore.textContent=score.red;blueScore.textContent=score.blue;
  boardRed.textContent=score.red;boardBlue.textContent=score.blue;
}
function updatePlayer(dt){
  sprint=keys.ShiftLeft||keys.ShiftRight; crouch=keys.ControlLeft||keys.ControlRight;
  const speed=(sprint?10:6)*(crouch?.45:1);
  const f=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let move=new THREE.Vector3();
  if(keys.KeyW)move.add(f.clone().multiplyScalar(-1));
  if(keys.KeyS)move.add(f);
  if(keys.KeyA)move.add(r.clone().multiplyScalar(-1));
  if(keys.KeyD)move.add(r);
  if(move.lengthSq())move.normalize().multiplyScalar(speed*dt);
  player.position.add(move);
  if(!flying) player.position.y=1.1+(crouch?-.3:0);
  if(keys.Space){
    if(player.position.y<=1.2) player.userData.vy=7;
    flying=true;
  } else if(player.position.y<=1.1) flying=false;
  player.userData.vy=(player.userData.vy||0)-18*dt;
  if(flying && keys.Space) player.userData.vy=5;
  player.position.y+=player.userData.vy*dt;
  if(player.position.y<1.1) {player.position.y=1.1;player.userData.vy=0;}
}
function updateVehicle(dt){
  const v=vehicle;
  const accel=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  v.speed += accel*22*dt;
  v.speed *= Math.pow(.18,dt);
  if(keys.KeyA)v.heading+=1.8*dt*(Math.abs(v.speed)/8+.2);
  if(keys.KeyD)v.heading-=1.8*dt*(Math.abs(v.speed)/8+.2);
  v.g.rotation.y=v.heading;
  const dir=new THREE.Vector3(Math.sin(v.heading),0,Math.cos(v.heading));
  v.g.position.add(dir.multiplyScalar(v.speed*dt));
  v.g.position.y=keys.Space?Math.min(45,v.g.position.y+18*dt):Math.max(.8,v.g.position.y-10*dt);
}
function cameraUpdate(){
  const target=vehicle?vehicle.g:player;
  const back=new THREE.Vector3(0,vehicle?4.2:2.4,vehicle?9:7);
  back.applyEuler(new THREE.Euler(0,yaw,0));
  camera.position.lerp(target.position.clone().add(back),.12);
  const look=target.position.clone(); look.y+=vehicle?.8:.7;
  camera.lookAt(look);
}

addEventListener("keydown",e=>{
  keys[e.code]=true;
  if(e.code==="Tab"){e.preventDefault();scoreboard.classList.toggle("hidden");}
  if(e.code==="KeyF"||e.code==="KeyE")enterExit();
});
addEventListener("keyup",e=>keys[e.code]=false);
addEventListener("mousedown",()=>{mouseDown=true; if(document.pointerLockElement!==renderer.domElement) renderer.domElement.requestPointerLock();});
addEventListener("mouseup",()=>mouseDown=false);
addEventListener("mousemove",e=>{
  if(document.pointerLockElement===renderer.domElement){
    yaw-=e.movementX*.0022; pitch-=e.movementY*.0022;
    pitch=Math.max(-1.25,Math.min(.7,pitch));
  }
});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.033);
  if(vehicle)updateVehicle(dt); else updatePlayer(dt);
  if(mouseDown&&!vehicle)shoot();
  cameraUpdate();
  renderer.render(scene,camera);
}
updateScore();
document.getElementById("loading").style.display="none";
status("Выберите транспорт клавишей F/E рядом с машиной");
animate();
