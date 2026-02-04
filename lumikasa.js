'use strict';

//Lumikasa source code (Luokkanen Janne, 2015-2026)
const version = "0x4D6";

function TimeNow(){
	//return Date.now();
	return performance.now();
}
function GetRender(canvas){
	return canvas.getContext('2d', { willReadFrequently: true }); //software canvas greatly improves performance on Chromium
}

const Menu = {active:null,subMenu:null,animMenu:null,animating:false,animForce:0.025,animThreshold:0.25};
const Option = {selected:null,active:null,last:null,select:false,cancel:0};
const Loading = {inProgress:true,done:false,skipAdventure:false,progress:0,barProgress:0,initStages:false,initLevels:false};
let playerConfirm = false, firstJoined = 0;
let defaultAnimForce = 0.025, areaScaleAnimForce = 0.001;
let directionInputRepeatDelay = 500; //ms

const Mouse = {x:0,y:0,startX:0,startY:0,axisX:0,axisY:0,draw:-1,drag:false};
let scrollAxisX = 0, scrollAxisY = 0, scrollBuffer = 0;

const Color = {
	menuBg:"#000000DD",
	menuBorder:"#00AAAA",
	menuText:"#FFFF00",
	menuTextFade:"#777700",
	menuTitle:"#FFFFFF",
	optionBg:"#000000DD",
	optionBorder:"#00AAAA",
	optionText:"#00AAAA",
	optionFade:"#005555",
	optionBgHgl:"#008888DD",
	optionBorderHgl:"#FFFFFF",
	optionTextHgl:"#FFFFFF",
	plainText:"#FFFFFF",
	playerText:"#000000"
};
const PlayerColor = [null,
{color:"#0000FF", fade:"#000077", bg:"#CCCCFF", bgFade:"#666677"}, //player1
{color:"#FF0000", fade:"#770000", bg:"#FFCCCC", bgFade:"#776666"}, //player2
{color:"#00FF00", fade:"#007700", bg:"#CCFFCC", bgFade:"#667766"}, //player3
{color:"#FFFF00", fade:"#777700", bg:"#FFFFCC", bgFade:"#777766"} //player4
];

const GameMode = {adventure:0,battle:1};
const GameType = {score:0,life:1};

const Game = {
	maxSpeed:0.625,
	positionCorrection:0.05,
	jumpForce:-0.625,
	maxDropSpeed:1.25,
	ballSpeed:2.5,
	knockBackForce:0.02,
	momentumThreshold:0.005,
	momentumChange:0.00025,
	friction:0.001,
	acceleration:0.0025,
	dropAcceleration:0.002,
	chargeInterval:10, //ms
	jumpLimit:300, //ms
	invulnerabilityLimit:5000, //ms
	statusVisibilityLimit:5000, //ms
	mode:GameMode.adventure,
	type:GameType.score,
	pause:true,
	started:false,
	noClip:false,
	noBounds:false,
	noCollect:false,
	noGrow:false,
	noPile:false,
	noKnockback:false,
	collectCharge:false,
	instantCharge:false,
	wallJump:false,
	infiniteJump:false,
	fixedCamera:false,
	shotSpeed:5,
	aimArea:1000,
	aimMargin:0.6,
	panMultiplier:100,
	winScore:5,
	lifeCount:3,
	levelIndex:0,
	soundVolume:0.15,
	updateInterval:2,
	speedMultiplier:0,
	lastTime:TimeNow(),
	steps:0,
	frameHold:false,
	frameStep:false,
	debugMode:false
};
for(let i = 0; i < 11; i++) //saving base speed and acceleration values
	Game["base"+Object.keys(Game)[i]] = Game[Object.keys(Game)[i]];

const LevelImages = [];
for(let i = 0; i <= 68; i++) LevelImages.push("assets/level"+i+".png");
let loadLevelCount = LevelImages.length;
let initLevelCount = loadLevelCount;

const StageImages = [
	"assets/stage0.png",
	"assets/stage1.png",
	"assets/stage2.png",
	"assets/stage3.png",
	"assets/stage4.png",
	"assets/stage5.png",
	"assets/stage6.png",
	"assets/stage7.png",
	"assets/terrain.gif"
];
let loadStageCount = StageImages.length;
let initStageCount = loadStageCount;

let Levels = [];
for(let i = 0; i < LevelImages.length; i++){
	Levels.push(new Image());
	Levels[i].onload = function(){if(!Loading.skipAdventure)loadLevelCount--;};
	Levels[i].src = LevelImages[i];
}
let Stages = [];
for(let i = 0; i < StageImages.length; i++){
	Stages.push(new Image());
	Stages[i].onload = function(){loadStageCount--;};
	Stages[i].src = StageImages[i];
}

let stageCanvas = document.createElement('canvas');
let stageRender = GetRender(stageCanvas);

const Terrain = {
	canvas:null,
	render:null,
	colData:[],
	collided:new Array(Levels.length),
	ResetCollided(){
		let collidedLength = Game.mode===GameMode.adventure ? this.collided.length : 1;
		for(let c = 0; c < collidedLength; c++)
			this.collided[c] = false;
	},
	pixelIndex:0,
	pixelBit:0,
	pixelMask:0
};

const Crosshair = [null,new Image(),new Image(),new Image(),new Image()];
let loadCrossCount = Crosshair.length-1;
for(let i = 1; i < Crosshair.length; i++){
	Crosshair[i].src = "assets/crosshair"+i+".gif";
	Crosshair[i].onload = function(){
		loadCrossCount--;
		this.xOffset = this.naturalWidth/2;
		this.yOffset = this.naturalHeight/2;
	};
}

const Sounds = {
	confirm:new Audio("assets/confirm.ogg"),
	cancel:new Audio("assets/cancel.ogg"),
	select:new Audio("assets/select.ogg"),
	snow:new Audio("assets/snow.ogg"),
	charge:new Audio("assets/charge.ogg"),
	shot:new Audio("assets/shot.ogg"),
	death:new Audio("assets/death.ogg")
};
let loadSoundCount = Object.keys(Sounds).length;
for(let sound in Sounds){
	if(Sounds.hasOwnProperty(sound))
		Sounds[sound].oncanplaythrough = function(){loadSoundCount--;};
}

const Players = [];
for(let i = 0; i <= 4; i++){
	Players.push({
		canvas:null,
		render:null,
		copyCanvas:null,
		copyRender:null,
		aimAxisX:0.0,
		aimAxisY:0.0,
		aimCentered:false,
		aimX:0,
		aimY:0,
		Balls:[],
		cancelKey:false,
		chargeCount:0,
		chargeHold:false,
		charging:false,
		chargeValue:0,
		colBottom:0,
		colMiddle:0,
		colPoints:[],
		colRadius:0,
		colTop:0,
		confirmKey:false,
		directionInputTime:0,
		down:false,
		downValue:0,
		inputMethod:-1,
		inputInfo:{id:"", index:null},
		invulnerability:0,
		joined:false,
		jump:false,
		jumpTimer:0,
		left:false,
		leftValue:0,
		level:0,
		lives:0,
		momentumX:0.0, //current X-momentum
		momentumY:0.0, //current Y-momentum
		newJump:true, //prevents jump from happening repeatedly
		number:i,
		onGround:false,
		pauseKey:false,
		playerHeight:0, //change name: height?
		playerPosX:0,	//change name: posX?
		playerPosY:0,	//change name: posY?
		playerRadius:0,
		playerWidth:0, //change name: width?
		pixelCount:0,
		pixelCountMax:0, //amount of pixels that need to be collected before growth
		right:false,
		rightValue:0,
		rotMomentum:0.0,
		score:0,
		sizeLevel:0,
		Sounds:{
			charge:new Audio(Sounds.charge.src),
			death:new Audio(Sounds.death.src)
		},
		statusVisibility:0,
		up:false,
		upValue:0
		});
		
		Players[i].canvas = document.createElement('canvas');
		Players[i].canvas.height = 0;
		Players[i].canvas.width = 0;
		Players[i].render = GetRender(Players[i].canvas);
		
		Players[i].copyCanvas = document.createElement('canvas');
		Players[i].copyCanvas.height = 0;
		Players[i].copyCanvas.width = 0;
		Players[i].copyRender = GetRender(Players[i].copyCanvas);
}
let IngamePlayers = [];

//Rendering
let gameCanvas = document.getElementById('gameCanvas');
let gameRender = GetRender(gameCanvas);
let guiCanvas = document.createElement('canvas');
let guiRender = GetRender(guiCanvas);
let tempCanvas = document.createElement('canvas');
let tempRender = GetRender(tempCanvas);

const Screen = {
	width:0,
	height:0,
	scaledWidth:0,
	scaledHeight:0,
	scaledWidthHalf:0,
	scaledHeightHalf:0,
	deviceRatio:0,
	pixelRatio:0,
	pixelScale:100,
	guiScale:1,
	guiScaleOn:true,
	smoothing:true,
	noClear:false,
	vsync:true
};

//Useful variables
let guiX=0,guiY=0;
let levelPosX=0,levelPosY=0;
let areaScale=1;
let middleOffsetX=0,middleOffsetY=0;
let ballX=0,ballY=0;
let ballLevelX=0,ballLevelY=0;
const degToRad = Math.PI/180;

let snowRate = 0;
function SnowRate(multiplier,min){
	return Clamp(snowRate*Math.pow(multiplier,Game.speedMultiplier),min,1); //old: return Clamp(snowRate*multiplier,min,1);
}
let stageRow = 0, stageRowStep = 0, stageColumnCount = 3;
function GetLastStageRow(){
	return Math.max(0,Math.ceil(Stages.length/stageColumnCount)-stageColumnCount);
}

const Input = {
	up:0,
	down:1,
	left:2,
	right:3,
	jump:4,
	charge:5,
	chargehold:6,
	confirm:7,
	cancel:8,
	pause:9,
	aimXneg:10,
	aimXpos:11,
	aimYneg:12,
	aimYpos:13
};
let guiNavInputs = [];
const defaultKeyboard = [
	{name:["ArrowUp","W"], input:["ArrowUp","KeyW"], deadzone:0},
	{name:["ArrowDown","S"], input:["ArrowDown","KeyS"], deadzone:0},
	{name:["ArrowLeft","A"], input:["ArrowLeft","KeyA"], deadzone:0},
	{name:["ArrowRight","D"], input:["ArrowRight","KeyD"], deadzone:0},
	{name:["ArrowUp","W"], input:["ArrowUp","KeyW"], deadzone:0},
	{name:["Mouse0"], input:["m0"], deadzone:0},
	{name:["Mouse2"], input:["m2"], deadzone:0},
	{name:["Enter"], input:["Enter"], deadzone:0},
	{name:["Backspace"], input:["Backspace"], deadzone:0},
	{name:["Pause","P"], input:["Pause","KeyP"], deadzone:0},
	{name:["-MouseX"], input:["-mX"], deadzone:0},
	{name:["+MouseX"], input:["+mX"], deadzone:0},
	{name:["-MouseY"], input:["-mY"], deadzone:0},
	{name:["+MouseY"], input:["+mY"], deadzone:0}];
const defaultGamepad = [
	{name:["-Axis(1)","Joy(12)"], input:["-a1",12], deadzone:0.25},
	{name:["+Axis(1)","Joy(13)"], input:["+a1",13], deadzone:0.25},
	{name:["-Axis(0)","Joy(14)"], input:["-a0",14], deadzone:0.25},
	{name:["+Axis(0)","Joy(15)"], input:["+a0",15], deadzone:0.25},
	{name:["-Axis(1)","Joy(12)"], input:["-a1",12], deadzone:0.5},
	{name:["Joy(7)"], input:[7], deadzone:0.01},
	{name:["Joy(6)"], input:[6], deadzone:0.01},
	{name:["Joy(0)"], input:[0], deadzone:0.5},
	{name:["Joy(1)"], input:[1], deadzone:0.5},
	{name:["Joy(9)"], input:[9], deadzone:0.5},
	{name:["-Axis(2)"], input:["-a2"], deadzone:0.2},
	{name:["+Axis(2)"], input:["+a2"], deadzone:0.2},
	{name:["-Axis(3)"], input:["-a3"], deadzone:0.2},
	{name:["+Axis(3)"], input:["+a3"], deadzone:0.2}];
let KeyBindings = []; //upKey,downKey,leftKey,rightKey,jumpKey,chargeKey,chargeHoldKey,confirmKey,cancelKey,pauseKey,-AimX,+AimX,-AimY,+AimY
function GetDefaultBindings(defaultBindings){
	let bindings = [];
	
	for(let defaultBinding of defaultBindings)
		bindings.push({name:defaultBinding.name.slice(), input:defaultBinding.input.slice(), deadzone:defaultBinding.deadzone, value:new Array(defaultBinding.input.length).fill(0), blocked:new Array(defaultBinding.input.length).fill(false)});
	
	return bindings;
}
const DzSlider = {width:5,target:5,small:5,large:15}; //deadzoneSlider
const KeyBind = {
	inProgress:false,
	reset:false,
	timeOut:5,//seconds
	time:0,
	timer:null,
	text:"",
	inputType:-1,
	player:1
};
let gamepadTemp = null;
const InputMethods = [
{id:"Keyboard&Mouse", index:-1, players:[1]}
];
Players[1].inputMethod = 0;
Players[1].inputInfo = {id:InputMethods[0].id, index:InputMethods[0].index};
KeyBindings[0] = GetDefaultBindings(defaultKeyboard); //player0
KeyBindings[1] = GetDefaultBindings(defaultKeyboard); //player1
KeyBindings[2] = GetDefaultBindings(defaultGamepad); //player2
KeyBindings[3] = GetDefaultBindings(defaultGamepad); //player3
KeyBindings[4] = GetDefaultBindings(defaultGamepad); //player4

const DebugKeys = {
	ScrollLock(){
		Game.debugMode=!Game.debugMode;
		PerfInfo.Reset();
	},
	Comma(){
		Game.frameHold=!Game.frameHold;
		Game.lastTime = TimeNow();
	},
	Period(){
		Game.frameStep=true;
		Game.frameHold=true;
		Game.lastTime = TimeNow();
	},
	KeyX(){
		Screen.guiScaleOn=!Screen.guiScaleOn;
		ScreenSize();
	},
	KeyN(){
		if(Screen.pixelScale>1)Screen.pixelScale--;
		ScreenSize();
	},
	KeyM(){
		Screen.pixelScale++;
		ScreenSize();
	},
	KeyZ(){
		Screen.smoothing=!Screen.smoothing;
		ScreenSize();
	},
	KeyC(){Screen.noClear=!Screen.noClear;},
	KeyV(){Screen.vsync=!Screen.vsync;},
	KeyG(){LoadLevel(Game.levelIndex-1);},
	KeyH(){LoadLevel(Game.levelIndex+1);},
	KeyJ(){Game.aimMargin = Clamp(Game.aimMargin*0.98, 0.0001, 1);},
	KeyL(){Game.aimMargin = Clamp(Game.aimMargin*1.02, 0.0001, 1);},
	KeyI(){Game.aimArea = Clamp(Game.aimArea*0.98, 1, Infinity);},
	KeyK(){Game.aimArea = Clamp(Game.aimArea*1.02, 1, Infinity);},
	KeyU(){if(Game.panMultiplier>0) Game.panMultiplier--;},
	KeyO(){Game.panMultiplier++;},
	Home(){Game.updateInterval++;},
	End(){if(Game.updateInterval>1) Game.updateInterval--;},
	PageUp(){UpdateMultiplier(Game.speedMultiplier+1);},
	PageDown(){UpdateMultiplier(Game.speedMultiplier-1);},
	Digit1(){Game.noClip=!Game.noClip;},
	Digit2(){Game.noBounds=!Game.noBounds;},
	Digit3(){Game.noCollect=!Game.noCollect;},
	Digit4(){Game.noGrow=!Game.noGrow;},
	Digit5(){Game.noPile=!Game.noPile;},
	Digit6(){Game.noKnockback=!Game.noKnockback;},
	Digit7(){Game.collectCharge=!Game.collectCharge;},
	Digit8(){Game.instantCharge=!Game.instantCharge;},
	Digit9(){Game.wallJump=!Game.wallJump;},
	Digit0(){Game.infiniteJump=!Game.infiniteJump;},
	Backquote(){Game.fixedCamera=!Game.fixedCamera;},
	Minus(){if(Game.shotSpeed>0) Game.shotSpeed--;},
	Equal(){Game.shotSpeed++;}
};
const PerfInfo = {
	Reset(){
		this.frameCount=0;
		this.totalFrameCount=0;
		this.fps=0;
		this.fpsLog=[];
		this.frameTime=0;
		this.frameTimeMax=0;
		//this.frameTimeLog=[];
		this.frameInfo="";
		this.fpsInfo="";
		this.lastTime=TimeNow();
		this.fpsUpdate=TimeNow();
	},
	LogFrame(currentTime){
		this.frameCount++;
		this.totalFrameCount++;
		this.frameTime = currentTime-this.lastTime;
		this.frameTimeMax = Math.max(this.frameTime,this.frameTimeMax);
		//this.frameTimeLog.push(this.frameTime);
		this.frameInfo = "Frame:"+this.totalFrameCount+" | "+this.frameTime.toFixed(3)+"ms (max:"+this.frameTimeMax.toFixed(3)+") | Steps:"+Game.steps.toFixed(3);
		this.lastTime = currentTime;
	},
	LogFps(currentTime){
		this.fps = this.frameCount * 1000/(currentTime-this.fpsUpdate);
		this.frameCount = 0;
		this.fpsLog.push(this.fps);
		let fpsAvg = this.fpsLog.reduce((sum, val) => sum + val)/this.fpsLog.length;
		this.fpsInfo = "Avg:"+fpsAvg.toFixed(2)+" | "+this.fps.toFixed(2);
		this.fpsUpdate = currentTime;
	},
	Update(currentTime){
		this.LogFrame(currentTime);
		if((currentTime-this.fpsUpdate)>=500)
			this.LogFps(currentTime);
	}
};

function PlaySound(sound){
	if(Game.soundVolume>0){
		sound.volume = Game.soundVolume;
		//sound.pause();
		sound.currentTime=0;
		if(sound.paused)
			sound.play();
	}
} function LoopSound(sound,volumeMultiplier){
	if(Game.soundVolume>0){
		sound.volume = Game.soundVolume*volumeMultiplier;
		if(sound.paused){
			sound.loop = true;
			sound.play();
		}
	}
} function StopLoop(sound){
	sound.volume = 0;
	sound.loop = false;
} function StopLoops(sounds){
	for(let sound in sounds){
		if(sounds.hasOwnProperty(sound)){
			if(sounds[sound].loop)
				StopLoop(sounds[sound]);
		}
	}
} function StopSound(sound){
	sound.volume = 0;
	sound.loop = false;
	//sound.pause(); //seems to cause issues
} function StopAllSounds(){
	for(let sound in Sounds){
		if(Sounds.hasOwnProperty(sound))
			StopSound(Sounds[sound]);
	}
	for(let player of Players){
		for(let sound in player.Sounds){
			if(player.Sounds.hasOwnProperty(sound))
				StopSound(player.Sounds[sound]);
		}
		for(let ball of player.Balls){
			for(let sound in ball.Sounds){
				if(ball.Sounds.hasOwnProperty(sound))
					StopSound(ball.Sounds[sound]);
			}
		}
	}
}
function ScreenSize(){ //Initialize game screen and update sizes (if screensize changes...)
	Screen.deviceRatio = window.devicePixelRatio;
	Screen.pixelRatio = Math.max(Screen.deviceRatio*(Screen.pixelScale/100),1/gameCanvas.offsetWidth,1/gameCanvas.offsetHeight);
	Screen.width = gameCanvas.offsetWidth*Screen.pixelRatio;
	Screen.height = gameCanvas.offsetHeight*Screen.pixelRatio;
	
	gameCanvas.width = guiCanvas.width = Screen.width;
	gameCanvas.height = guiCanvas.height = Screen.height;
	
	if(Screen.guiScaleOn){
		Screen.guiScale = Math.min(Screen.width/1280,Screen.height/720);
		
		/*if(Screen.guiScale>=1)
			Screen.guiScale = Math.floor(Screen.guiScale);*/ //integer scale for menus if resolution is high enough
		
		guiRender.scale(Screen.guiScale,Screen.guiScale);
	} else
		Screen.guiScale = 1;
	
	gameRender.imageSmoothingEnabled = guiRender.imageSmoothingEnabled = Screen.smoothing;
	
	Screen.scaledWidth = Screen.width/Screen.guiScale;
	Screen.scaledHeight = Screen.height/Screen.guiScale;
	
	Screen.scaledWidthHalf = Math.floor(Screen.scaledWidth/2);
	Screen.scaledHeightHalf = Math.floor(Screen.scaledHeight/2);
}
function UpdateMultiplier(value){ //pre-calculate movement values
	let newSpeedMultiplier = (value>1) ? value : 1;
	let speedModifier = newSpeedMultiplier/Game.speedMultiplier;
	Game.speedMultiplier = newSpeedMultiplier;
	
	for(let ingamePlayer of IngamePlayers){
		ingamePlayer.momentumX *= speedModifier;
		ingamePlayer.momentumY *= speedModifier;
		ingamePlayer.rotMomentum *= speedModifier;
	}
	
	Game.maxSpeed = Game.basemaxSpeed*Game.speedMultiplier;
	Game.positionCorrection = Game.basepositionCorrection*Game.speedMultiplier;
	Game.jumpForce = Game.basejumpForce*Game.speedMultiplier;
	Game.maxDropSpeed = Game.basemaxDropSpeed*Game.speedMultiplier;
	Game.ballSpeed = Game.baseballSpeed*Game.speedMultiplier;
	Game.knockBackForce = Game.baseknockBackForce*Game.speedMultiplier;
	Game.momentumThreshold = Game.basemomentumThreshold*Game.speedMultiplier;
	
	Game.momentumChange = Game.basemomentumChange*Math.pow(Game.speedMultiplier,2);
	Game.friction = Game.basefriction*Math.pow(Game.speedMultiplier,2);
	Game.acceleration = Game.baseacceleration*Math.pow(Game.speedMultiplier,2);
	Game.dropAcceleration = Game.basedropAcceleration*Math.pow(Game.speedMultiplier,2);
}
function DirectionalKey(player, inputType, state, value){
	let oldState = false;
	if(inputType === Input.up){
		oldState = player.up;
		player.up = state;
		player.upValue = value;
	} else if(inputType === Input.down){
		oldState = player.down;
		player.down = state;
		player.downValue = value;
	} else if(inputType === Input.left){
		oldState = player.left;
		player.left = state;
		player.leftValue = value;
	} else if(inputType === Input.right){
		oldState = player.right;
		player.right = state;
		player.rightValue = value;
	}
	
	if(playerConfirm || Menu.active===null || !state)
		return;
	
	if(!oldState)
		player.directionInputTime = TimeNow();
	else if(TimeNow()-player.directionInputTime < directionInputRepeatDelay)
		return;
	PushGuiNavInput(inputType);
} function JumpKey(player, state){
	if(state){
		if(player.newJump){
			player.jump = true;
			player.newJump = false;
		}
	} else {
		if(player.jumpTimer>0)
			player.jumpTimer = Game.jumpLimit;
		player.jump = false;
		player.newJump = true;
	}
} function ChargeKey(player, state, value){
	player.charging = state;
	player.chargeValue = value;
	if(!state)
		player.chargeCount = 0;
} function ChargeHoldKey(player, state){
	player.chargeHold = state;
} function ConfirmKey(player, state){
	if(!player.confirmKey && state){
		if(playerConfirm){
			if(player.number>0 && !player.joined){
				player.joined = true;
				if(firstJoined===0)
					firstJoined = player.number;
				PlaySound(Sounds.confirm);
			}
		} else if(Menu.active!==null)
			PushGuiNavInput(Input.confirm);
	}
	player.confirmKey = state;
} function CancelKey(player, state){
	if(!player.cancelKey && state){
		if(Menu.subMenu!==null || Menu.active===GUI.pause)
			PushGuiNavInput(Input.cancel);
	}
	player.cancelKey = state;
} function PauseKey(player, state){
	if(!player.pauseKey && state){
		if(Game.started && !Game.pause)
			Pause();
		//else if(Menu.active===GUI.pause)
			//PushGuiNavInput(Input.cancel);
		else if(playerConfirm){
			if(player.number===firstJoined && player.joined)
				ConfirmPlayers();
		}
	}
	player.pauseKey = state;
} function Aim(player,x=null,y=null){ //both x and y = null -> Update AimX/Y
	if(x!==null || y!==null){
		if(x!==null) player.aimAxisX = x;
		if(y!==null) player.aimAxisY = y;
		return;
	}
	//Update AimX/Y
	let mouseXaim = false, mouseYaim = false;
	if(InputMethods[0].players.includes(player.number)){ //keyboard&mouse
		let Bind = KeyBindings[player.number];
		//checking if mouseAxis is assigned to aimAxes
		for(let type = Input.aimXneg; type <= Input.aimXpos; type++)
		for(let axis of Bind[type].input)
			mouseXaim = (axis[1] === 'm' || mouseXaim);
		
		for(let type = Input.aimYneg; type <= Input.aimYpos; type++)
		for(let axis of Bind[type].input)
			mouseYaim = (axis[1] === 'm' || mouseYaim);
	}
	if(mouseXaim)
		player.aimX=(player.aimAxisX*Screen.width+Screen.width)/2/areaScale;
	else {
		player.aimX=player.playerPosX+player.playerRadius;
		
		if(player.aimAxisX<0)
			player.aimX+=(player.playerPosX+player.playerRadius)*player.aimAxisX;
		else if(player.aimAxisX>0)
			player.aimX+=(Screen.width/areaScale-player.playerPosX-player.playerRadius)*player.aimAxisX;
	}
	if(mouseYaim)
		player.aimY=(player.aimAxisY*Screen.height+Screen.height)/2/areaScale;
	else {
		player.aimY=player.playerPosY+player.playerRadius;
		
		if(player.aimAxisY<0)
			player.aimY+=(player.playerPosY+player.playerRadius)*player.aimAxisY;
		else if(player.aimAxisY>0)
			player.aimY+=(Screen.height/areaScale-player.playerPosY-player.playerRadius)*player.aimAxisY;
	}
	if(player.aimAxisX === 0 && player.aimAxisY === 0)
		player.aimCentered = true;
	else
		player.aimCentered = false;
}
function SetInput(inputType,inputState,player,value){
	if(inputType === Input.up || inputType === Input.down || inputType === Input.left || inputType === Input.right)
		DirectionalKey(player, inputType, inputState, value);
	else if(inputType === Input.jump)
		JumpKey(player,inputState);
	else if(inputType === Input.charge)
		ChargeKey(player,inputState,value);
	else if(inputType === Input.chargehold)
		ChargeHoldKey(player,inputState);
	else if(inputType === Input.confirm)
		ConfirmKey(player,inputState);
	else if(inputType === Input.cancel)
		CancelKey(player,inputState);
	else if(inputType === Input.pause)
		PauseKey(player,inputState);
	else if(inputType === Input.aimXneg){
		if(inputState)
			Aim(player,-value,null);
		else if(player.aimAxisX<0)
			Aim(player,0,null);
	} else if(inputType === Input.aimXpos){
		if(inputState)
			Aim(player,value,null);
		else if(player.aimAxisX>0)
			Aim(player,0,null);
	} else if(inputType === Input.aimYneg){
		if(inputState)
			Aim(player,null,-value);
		else if(player.aimAxisY<0)
			Aim(player,null,0);
	} else if(inputType === Input.aimYpos){
		if(inputState)
			Aim(player,null,value);
		else if(player.aimAxisY>0)
			Aim(player,null,0);
	}
}
function InputUpdate(input,players,value){
	let validInput = false;
	for(let playerNum of players){
		let keyBind = KeyBindings[playerNum];
		for(let k = 0; k < keyBind.length; k++){
			for(let i = 0; i < keyBind[k].input.length; i++){
				if(input === keyBind[k].input[i]){
					validInput = true;
					
					let prevValue = keyBind[k].value[i];
					keyBind[k].value[i] = Math.abs(value);
					
					if(keyBind[k].value[i] > keyBind[k].deadzone){ //InputDown
						if(keyBind[k].blocked[i])
							continue;
						
						SetInput(k,true,Players[playerNum],(keyBind[k].value[i]-keyBind[k].deadzone)/(1-keyBind[k].deadzone)); //last parameter used to be just keyBind[k].value[i]
						
					} else if(keyBind[k].value[i] <= keyBind[k].deadzone){ //InputUp (keyBind[k].value[i] < keyBind[k].deadzone || keyBind[k].value[i]===0???)
						keyBind[k].blocked[i] = false;
						if(prevValue > keyBind[k].deadzone)
							SetInput(k,false,Players[playerNum],keyBind[k].value[i]);
					}
				}
			}
		}
	}
	return validInput;
}
function UpdateMousePos(x,y){
	Mouse.x = x/Screen.guiScale*Screen.pixelRatio;
	Mouse.y = y/Screen.guiScale*Screen.pixelRatio;
	Mouse.axisX = Mouse.x/(Screen.scaledWidthHalf)-1;
	Mouse.axisY = Mouse.y/(Screen.scaledHeightHalf)-1;
}
document.addEventListener('keydown', function(event){
	if(event.code==="")
		return;
	if(KeyBind.inProgress){
		if(Players[KeyBind.player].inputMethod===0){
			SetKeyBind(event.code.replace('Key',''), event.code);
			StopKeyBind();
		} event.preventDefault();
	}
	else if(Loading.inProgress && event.code === "Enter")
		CloseLoadingScreen();
	else if(InputUpdate(event.code,InputMethods[0].players,1))
		event.preventDefault();
	else {
		if(event.code === "Escape" && document.fullscreenElement)
			document.exitFullscreen();
		else if(event.code === "KeyF" || event.code === "F4"){ //Enable fullscreen
			if(document.fullscreenElement)
				document.exitFullscreen();
			else
				gameCanvas.requestFullscreen();
			
			event.preventDefault();
		} else if(DebugKeys.hasOwnProperty(event.code)){
			if(Game.debugMode || event.code === Object.keys(DebugKeys)[0])//other DebugKeys are checked only in debugMode
				DebugKeys[event.code]();
			event.preventDefault();
		}
	}
});
document.addEventListener('keyup', function(event){
	InputUpdate(event.code,InputMethods[0].players,0);
});
gameCanvas.addEventListener('mousedown', function(event){
	UpdateMousePos(event.clientX-this.offsetLeft,event.clientY-this.offsetTop);
	if(KeyBind.inProgress){
		if(Players[KeyBind.player].inputMethod===0){
			SetKeyBind("Mouse"+event.button, "m"+event.button);
			StopKeyBind();
		}
	} else if(!Loading.inProgress && Menu.active!==null){
		if(CheckMouse(true))
			PushGuiNavInput(Input.confirm);
		else if(Menu.subMenu===null)
			Mouse.draw = event.button;
		else
			InputUpdate("m"+event.button,InputMethods[0].players,1);
	} else
		InputUpdate("m"+event.button,InputMethods[0].players,1);
	
	event.preventDefault();
});
document.addEventListener('mouseup', function(event){
	InputUpdate("m"+event.button,InputMethods[0].players,0);
	Mouse.draw = -1;
	Mouse.drag = false;
});
gameCanvas.addEventListener('mousemove', function(event){
	UpdateMousePos(event.clientX-this.offsetLeft,event.clientY-this.offsetTop);
	if(KeyBind.inProgress){
		if(Players[KeyBind.player].inputMethod===0){
			if((Mouse.x-Mouse.startX < -50 && Mouse.x < Screen.scaledWidth*0.1) || (Mouse.x-Mouse.startX > 50 && Mouse.x >= Screen.scaledWidth*0.9)){
				let axisSign = Math.sign(Mouse.x-Mouse.startX)===1 ? "+" : "-";
				let axisName = axisSign + "MouseX";
				let axisCode = axisSign + "mX";
				
				SetKeyBind(axisName, axisCode);
				
				StopKeyBind();
			} else if((Mouse.y-Mouse.startY < -50 && Mouse.y < Screen.scaledHeight*0.1) || (Mouse.y-Mouse.startY > 50 && Mouse.y >= Screen.scaledHeight*0.9)){
				let axisSign = Math.sign(Mouse.y-Mouse.startY)===1 ? "+" : "-";
				let axisName = axisSign + "MouseY";
				let axisCode = axisSign + "mY";
				
				SetKeyBind(axisName, axisCode);
				
				StopKeyBind();
			}
		}
	} else if(!Loading.inProgress && Menu.active!==null){
		//let previousOption = Option.selected;
		CheckMouse(false);
		//if(previousOption !== Option.selected)
			//PlaySound(Sounds.select);
	}
	InputUpdate("-mX",InputMethods[0].players,Math.min(Mouse.axisX,0));
	InputUpdate("+mX",InputMethods[0].players,Math.max(Mouse.axisX,0));
	InputUpdate("-mY",InputMethods[0].players,Math.min(Mouse.axisY,0));
	InputUpdate("+mY",InputMethods[0].players,Math.max(Mouse.axisY,0));
});
gameCanvas.addEventListener('wheel', function(event){
	if(KeyBind.inProgress){
		if(Players[KeyBind.player].inputMethod===0){
			if(Math.abs(event.deltaX) > 1){
				let axisSign = Math.sign(event.deltaX)===1 ? "+" : "-";
				let axisName = axisSign + "ScrollX";
				let axisCode = axisSign + "sX";
				
				SetKeyBind(axisName, axisCode);
				
				StopKeyBind();
				scrollAxisX=0;
			} else if(Math.abs(event.deltaY) > 1){
				let axisSign = Math.sign(event.deltaY)===1 ? "+" : "-";
				let axisName = axisSign + "ScrollY";
				let axisCode = axisSign + "sY";
				
				SetKeyBind(axisName, axisCode);
				
				StopKeyBind();
				scrollAxisY=0;
			}
		}
		event.preventDefault();
	}
	if(Menu.subMenu===GUI.battle && !playerConfirm && Stages.length>0)
	if(MouseOver(GUI.battle.background[0])){
		if(Math.sign(scrollBuffer)!==Math.sign(event.deltaY)) //if scrolling to opposite direction
			scrollBuffer = event.deltaY;
		else
			scrollBuffer += event.deltaY;
		if(Math.abs(scrollBuffer)>=1){
			stageRow += Math.sign(scrollBuffer);
			
			let clampedStageRow = Clamp(stageRow, 0, GetLastStageRow());
			if(stageRow !== clampedStageRow)
				stageRow = clampedStageRow;
			else if(Option.selected.parent === GUI.battle.background[0]){
				let clampedStageButton = Clamp(Option.selected.stage+Math.sign(scrollBuffer)*stageColumnCount, 0, Stages.length-1);
				Option.selected = GUI.battle.stagebutton[clampedStageButton];
			}
			scrollBuffer = 0;
		}
		event.preventDefault();
		return;
	}
	/*if(Math.sign(scrollAxisX)!==Math.sign(event.deltaX) && event.deltaX!==0) //reset X to center if opposite movement
		scrollAxisX = 0;
	if(Math.sign(scrollAxisY)!==Math.sign(event.deltaY) && event.deltaY!==0) //reset Y to center if opposite movement
		scrollAxisY = 0;*/
	scrollAxisX = Clamp(scrollAxisX+event.deltaX/100, -1, 1);
	scrollAxisY = Clamp(scrollAxisY+event.deltaY/100, -1, 1);
	
	if(InputUpdate("-sX",InputMethods[0].players,Math.min(scrollAxisX,0)))
		event.preventDefault();
	if(InputUpdate("+sX",InputMethods[0].players,Math.max(scrollAxisX,0)))
		event.preventDefault();
	if(InputUpdate("-sY",InputMethods[0].players,Math.min(scrollAxisY,0)))
		event.preventDefault();
	if(InputUpdate("+sY",InputMethods[0].players,Math.max(scrollAxisY,0)))
		event.preventDefault();
});
gameCanvas.addEventListener('drop', function(event){
	event.preventDefault();
	for(let file of event.dataTransfer.files){
		if(Menu.subMenu!==GUI.battle || playerConfirm || Menu.animating){
			gameCanvas.style.backgroundImage = "url('"+URL.createObjectURL(file)+"')";
			break;
		}
		let customStageImage = new Image();
		customStageImage.src = URL.createObjectURL(file);
		
		loadStageCount++;
		
		customStageImage.onerror = function(){
			//alert("Could not load image.");
			loadStageCount--;
		};
		customStageImage.onload = function(){
			Stages.push(this);
			
			AddStageButton(Stages.length-1,this.naturalWidth,this.naturalHeight);
			
			if(Menu.subMenu===GUI.battle && !playerConfirm && !Menu.animating){
				stageRow = GetLastStageRow();
				Option.selected = GUI.battle.stagebutton[Stages.length-1];
			}
			
			loadStageCount--;
		};
	}
});
gameCanvas.addEventListener('dragover', function(event){
	event.preventDefault();
});
gameCanvas.addEventListener('contextmenu', function(event){
	if(!InputMethods[0].players.includes(0)) //if some player uses keyboard&mouse
		event.preventDefault();
});
gameCanvas.addEventListener('click', function(event){
	CloseLoadingScreen();
	gameCanvas.focus();
});
gameCanvas.addEventListener('dblclick', function(event){
	if(playerConfirm)
		ConfirmPlayers();
	event.preventDefault(); //is this needed?
});
window.addEventListener('resize', function(event){
	ScreenSize();
});
/*window.addEventListener('gamepadconnected', function(event){
	UpdateInputMethods();
});
window.addEventListener('gamepaddisconnected', function(event){
	UpdateInputMethods();
});*/
function UpdateInputMethods(){
	for(let pl = 1; pl < Players.length; pl++)
		Players[pl].inputMethod = -1;
	
	InputMethods.splice(1);
	InputMethods[0].players = [];
	for(let gamepad of navigator.getGamepads()){
		if(gamepad !== null && gamepad.connected)
			InputMethods.push({id:gamepad.id, index:gamepad.index, players:[]});
	}
	for(let im = 0; im < InputMethods.length; im++){
		for(let pl = 1; pl < Players.length; pl++){
			if(Players[pl].inputMethod === -1)
			if(Players[pl].inputInfo.id === InputMethods[im].id && Players[pl].inputInfo.index === InputMethods[im].index){
				InputMethods[im].players.push(pl);
				Players[pl].inputMethod = im;
			}
		}
	}
	if(InputMethods[0].players.length===0)
		InputMethods[0].players = [0];
	UpdateInputMethodMenu();
}
function CheckGamepads(){
	let gamepads = navigator.getGamepads();
	let emptyGamepads = 0;
	for(let gamepad of gamepads){
		if(gamepad === null || !gamepad.connected) //checking for empty gamepads
			emptyGamepads++;
	}
	if(gamepads.length-emptyGamepads !== InputMethods.length-1){
		if(KeyBind.inProgress)
			StopKeyBind();
		UpdateInputMethods();
	}
	
	if(InputMethods.length<=1) //if keyboard&mouse is the only inputMethod
		return;
	
	for(let im = 1; im < InputMethods.length; im++){
		let gamepad = gamepads[InputMethods[im].index];
		
		if(gamepad === null) //failsafe if gamepad disconnects during a session (Add !gamepad.connected if gamepad is not null?)
			continue;
		
		for(let b = 0; b < gamepad.buttons.length; b++)
			InputUpdate(b,InputMethods[im].players,gamepad.buttons[b].value);
		
		for(let a = 0; a < gamepad.axes.length; a++){
			let axisCode = Math.sign(gamepad.axes[a])===1 ? "+a"+a : "-a"+a;
			let inverseAxisCode = Math.sign(gamepad.axes[a])===1 ? "-a"+a : "+a"+a;
			
			InputUpdate(axisCode,InputMethods[im].players,gamepad.axes[a]);
			InputUpdate(inverseAxisCode,InputMethods[im].players,0);
		}
	}
	
	if(KeyBind.inProgress){
		if(Players[KeyBind.player].inputMethod < 1)
			return;
		
		let gamepad = gamepads[InputMethods[Players[KeyBind.player].inputMethod].index]; //or Players[KeyBind.player].inputInfo.index
		
		if(gamepadTemp.axisValues.length===0 && gamepadTemp.buttonValues.length===0){
			for(let button of gamepad.buttons)
				gamepadTemp.buttonValues.push(button.value);
			for(let axis of gamepad.axes)
				gamepadTemp.axisValues.push(Math.abs(axis));
		}
		let currentDeadzone = KeyBindings[KeyBind.player][KeyBind.inputType].deadzone;
		for(let b = 0; b < gamepad.buttons.length; b++){
			if(gamepad.buttons[b].value>=gamepadTemp.buttonValues[b] && gamepadTemp.buttonValues[b]>currentDeadzone) //prevents immediate keybind
				continue;
			
			gamepadTemp.buttonValues[b] = 0; //disables the first if statement
			if(gamepad.buttons[b].value > 0.9){
				SetKeyBind("Joy("+b+")", b);
				StopKeyBind();
				return;
			}
		}
		for(let a = 0; a < gamepad.axes.length; a++){
			if(Math.abs(gamepad.axes[a])>=gamepadTemp.axisValues[a] && gamepadTemp.axisValues[a]>currentDeadzone) //prevents immediate keybind
				continue;
			
			gamepadTemp.axisValues[a] = 0; //disables the first if statement
			if(Math.abs(gamepad.axes[a]) > 0.9){
				let axisSign = Math.sign(gamepad.axes[a])===1 ? "+" : "-";
				let axisName = axisSign + "Axis("+a+")";
				let axisCode = axisSign + "a"+a;
				
				SetKeyBind(axisName, axisCode);
				StopKeyBind();
				return;
			}
		}
	}
}
function CreateColData(imageData){
	let colData = new Uint8Array(Math.ceil(imageData.length/32)); //Optimized boolean array (bitfield)
	
	let counter = 0;
	let colValue = 0;
	let cellIndex = 0;
	for(let dataIndex = 3; dataIndex < imageData.length; dataIndex += 4){
		if(imageData[dataIndex]!==0) //colPoint if pixel alpha is not zero
			colValue+=Math.pow(2,counter);
		counter++;
		if(counter===8 || dataIndex===imageData.length-1){ //last dataIndex accounts for resolutions not divisible by 8
			colData[cellIndex]=colValue;
			cellIndex++;
			colValue=0;
			counter=0;
		}
		
	}
	return colData;
}
function GetPixelMask(terrainPixel){
	Terrain.pixelIndex = terrainPixel >> 3;
	Terrain.pixelBit = terrainPixel-(Terrain.pixelIndex << 3);
	return (1 << Terrain.pixelBit);
}
function GetLevelColData(terrainPixel){
	Terrain.pixelMask = GetPixelMask(terrainPixel);
	return (Terrain.colData[Terrain.pixelIndex] & Terrain.pixelMask);
}
function SetLevelColData(terrainPixel, active){
	Terrain.pixelMask = GetPixelMask(terrainPixel);
	
	if(active)
		Terrain.colData[Terrain.pixelIndex] |= Terrain.pixelMask;
	else
		Terrain.colData[Terrain.pixelIndex] &= ~Terrain.pixelMask;
}
function SetTerrainProperties(level){
	Terrain.canvas = Levels[level].canvas;
	Terrain.render = Levels[level].render;
	Terrain.colData = Levels[level].colData;
}
function UpdateLevelData(level,levelX,levelY){ //object.level could be updated in this function already?
	let newLevelX = levelX;
	let newLevelY = levelY;
	let newLevel = 0;
	if(Game.mode===GameMode.adventure){
		newLevel = FindLevel(level,newLevelX,newLevelY);
		SetTerrainProperties(newLevel);
		
		newLevelX -= Levels[newLevel].xOffset;
		newLevelY -= Levels[newLevel].yOffset;
	}
	return {level:newLevel, levelX:newLevelX, levelY:newLevelY};
}
function FindLevel(currentLevel,levelXpos,levelYpos){
	if(levelXpos<0)
		return 0;
	if(levelXpos > Levels[Levels.length-1].canvas.width+Levels[Levels.length-1].xOffset)
		return Levels.length-1;
	
	let newLevelLeft = levelXpos < Levels[currentLevel].xOffset;
	let newLevelRight = levelXpos >= Levels[currentLevel].canvas.width+Levels[currentLevel].xOffset;
	if(!newLevelLeft && !newLevelRight)
		return currentLevel;
	
	let newLevel = 0;
	let checkTarget = (newLevelLeft) ? 0 : Levels.length-1;
	let checkDirection = (newLevelLeft) ? -1 : 1;
	
	for(newLevel = currentLevel; newLevel !== checkTarget; newLevel+=checkDirection){
		if(levelXpos >= Levels[newLevel].xOffset && levelXpos < Levels[newLevel].canvas.width+Levels[newLevel].xOffset) //X-position is in bounds of the new level
			break;
	}
	
	if(levelYpos-Levels[newLevel].yOffset < 0 || levelYpos-Levels[newLevel].yOffset >= Levels[newLevel].canvas.height) //Y-position is not in bounds of the new level
		return currentLevel;
	
	return newLevel;
}
function LoadLevel(lIndex){
	if(Menu.active!==null || Loading.inProgress)
		return;
	
	if(Game.mode===GameMode.adventure){
		if(lIndex<0)
			lIndex=Levels.length-1;
		else if(lIndex>=Levels.length || lIndex===null) //failsafe
			lIndex=0;
		
		SetTerrainProperties(lIndex);
		
		for(let ingamePlayer of IngamePlayers)
			ingamePlayer.level = lIndex;
		
		levelPosX = -Levels[lIndex].xOffset;
		levelPosY = -Levels[lIndex].yOffset;
	} else {
		if(lIndex<0)
			lIndex=Stages.length-1;
		else if(lIndex>=Stages.length || lIndex===null) //failsafe
			lIndex=0;
		
		stageCanvas.width = Stages[lIndex].naturalWidth;
		stageCanvas.height = Stages[lIndex].naturalHeight;
		
		Terrain.canvas = stageCanvas;
		Terrain.render = stageRender;
		
		Terrain.render.drawImage(Stages[lIndex], 0, 0);
		
		Terrain.colData = CreateColData(Terrain.render.getImageData(0, 0, Terrain.canvas.width, Terrain.canvas.height).data);
	}
	Game.levelIndex = lIndex;
	InitializePlayers();
}
function InitializeGame(level){
	if(Game.mode===GameMode.adventure && !Game.debugMode){
		Game.shotSpeed = 5;
		Game.infiniteJump = false;
		Game.noKnockback = false;
		Game.instantCharge = false;
		Game.fixedCamera = false;
		Game.noPile = false;
	}
	
	IngamePlayers = [];
	for(let player of Players){
		if(player.joined)
			IngamePlayers.push(player);
	}
	
	LoadLevel(level);
	
	Game.pause = false;
	Game.started = true;
	Game.lastTime = TimeNow(); //adds a little delay when the game starts
}
function InitializePlayers(){
	for(let ingamePlayer of IngamePlayers)
		InitializePlayer(ingamePlayer,true);
}
function InitializePlayer(player,newGame){
	if(newGame){
		player.lives = Game.lifeCount;
		player.score = 0;
		player.statusVisibility = 0;
		for(let ball of player.Balls)
			StopLoops(ball.Sounds);
		player.Balls = [];
	}
	player.pixelCountMax = 100;
	player.sizeLevel = 0;
	player.momentumX = 0.0;
	player.momentumY = 0.0;
	player.rotMomentum = 0;
	player.jumpTimer = 0;
	player.onGround = false;
	
	player.playerWidth = 32;
	player.playerHeight = 32;
	
	player.canvas.height = player.playerHeight;
	player.canvas.width = player.playerWidth;
	
	player.render.fillStyle = "#FFFFFF";
	player.render.fillRect(0,0,player.canvas.width,player.canvas.height); //ChangeSize clips a circle arc from this
	
	let spawnPosX = levelPosX; //default for battleMode
	let spawnPosY = levelPosY; //default for battleMode
	if(Game.mode===GameMode.battle){
		let spawnPositions = [];
		let colWidth = Math.ceil(Terrain.canvas.width/8);
		let colHeight = Terrain.canvas.height;
		for(let cY = 0; cY < colHeight-31; cY+=8){ //finding all empty spots in the stage large enough for spawning (8x8 grid based, 32x32 minimum spawn area)
			spawnSearchLoop2:
			for(let cX = 0; cX < colWidth-4; cX++){
				if(Terrain.colData[cY*colWidth+cX]===0){ //8 empty horizontal pixels
					for(let cYs = 0; cYs < 32; cYs++){
						let col = (cY+cYs)*colWidth+cX;
						if(Terrain.colData[col] + Terrain.colData[col+1] + Terrain.colData[col+2] + Terrain.colData[col+3] > 0) //not 32 empty horizontal pixels
							continue spawnSearchLoop2;
					}
					spawnPositions.push({x:(cX << 3),y:cY}); //cX multiply by 8
				}
			}
		}
		if(spawnPositions.length>0){
			let randomSpot = Math.floor(Math.random() * spawnPositions.length);
			spawnPosX += spawnPositions[randomSpot].x;
			spawnPosY += spawnPositions[randomSpot].y;
		}
	}
	player.playerPosX = (Game.mode===GameMode.battle) ? spawnPosX : 0;
	player.playerPosY = (Game.mode===GameMode.battle) ? spawnPosY : 0;
	player.invulnerability = (Game.mode===GameMode.battle) ? Game.invulnerabilityLimit : 0;
	
	ChangeSize(0,player);
}
function ChangeSize(change, player){
	tempCanvas.height = player.playerHeight;
	tempCanvas.width = player.playerWidth;
	tempRender.drawImage(player.canvas,0,0);
	
	player.pixelCount=0;
	player.pixelCountMax+=2*change;
	player.sizeLevel+=2*change;
	player.playerHeight+=2*change;
	player.playerWidth+=2*change;
	
	player.canvas.height = player.playerHeight;
	player.canvas.width = player.playerWidth;
	
	player.playerRadius = player.playerHeight/2;
	
	player.render.beginPath();
	player.render.arc(player.playerRadius,player.playerRadius,player.playerRadius-1,0,2*Math.PI); //circle clipping area
	player.render.clip();
	
	player.render.drawImage(tempCanvas, change, change);
	
	player.playerPosX-=change;
	player.playerPosY-=change;
	
	player.colMiddle = player.playerRadius;
	player.colRadius = player.colMiddle-4; //4 pixel offset
	player.colTop = player.colRadius*(-0.9)+player.colMiddle;
	player.colBottom = player.colRadius*0.9+player.colMiddle;
	
	player.colPoints = []; //these are used only for terrain collision
	let angle=89;
	let angleStep=0;
	let flip=true;
	while(angle<269){
		angle += (flip) ? -angleStep : angleStep;
		flip = !flip;
		angleStep++;
		
		let radians = angle*degToRad;
		let colX = player.colRadius*Math.cos(radians)+player.colMiddle;
		let colY = player.colRadius*(-Math.sin(radians))+player.colMiddle;
		player.colPoints.push({x:colX,y:colY});
	}
}
function CreateShot(player){
	let newBall = player.Balls[
		player.Balls.push({
			ballPosX:0,
			ballPosY:0,
			ballRadius:0,
			ballSize:0,
			canvas:null,
			collided:false,
			firstColCheck:true,
			hitCount:0,
			hitLimit:100,
			isMoving:false,
			level:0,
			player:player,
			render:null,
			Sounds:{
				shot:new Audio(Sounds.shot.src)
			},
			Vectors:[],
			Xdirection:0,
			Ydirection:0
		})-1
	];
	
	newBall.canvas = document.createElement('canvas');
	newBall.canvas.width = 1;
	newBall.canvas.height = 1;
	newBall.render = GetRender(newBall.canvas);
	newBall.render.clearRect(0, 0, 1, 1); //is this needed?
	
	return newBall;
}
function RemoveShot(ball){
	let player = ball.player;
	
	StopLoops(ball.Sounds);
	player.Balls.splice(player.Balls.indexOf(ball),1);
}
function ChargeShot(change, ball){
	let player = ball.player;
	
	if(ball.ballSize===0){
		player.copyCanvas.height = player.playerHeight;
		player.copyCanvas.width = player.playerWidth;
		player.copyRender.drawImage(player.canvas,0,0);
	}
	ball.hitLimit+=2*change;
	ball.ballSize+=2*change;
	
	ball.canvas.height = ball.ballSize;
	ball.canvas.width = ball.ballSize;
	
	ball.ballRadius = ball.ballSize/2;
	
	ball.render.drawImage(player.copyCanvas, 0, 0, ball.ballSize, ball.ballSize);
}
function PlayerHit(player, enemy){
	if(Game.mode===GameMode.adventure){
		player.pixelCount+=1;
		if(player.pixelCount >= player.pixelCountMax)
			ChangeSize(1,player);
	} else if(player.invulnerability <= 0){
		player.pixelCount-=2; //enemy shots decrease size at double rate
		if(player.pixelCount <= 0){
			ChangeSize(-1,player);
			player.pixelCount = player.pixelCountMax;
			if(player.sizeLevel <= -10){
				PlaySound(player.Sounds.death);
				if(player.Balls.length > 0){ //removing unshot ball
					let latestBall = player.Balls[player.Balls.length-1];
					if(!latestBall.isMoving)
						RemoveShot(latestBall);
				}
				if(Game.type===GameType.score){
					//player.score = Math.max(player.score-1,0);
					enemy.score++;
					if(enemy.score >= Game.winScore)
						return true;
					
					enemy.statusVisibility = Game.statusVisibilityLimit;
				} else {
					player.lives--;
					if(player.lives<=0){
						player.score -= IngamePlayers.length-1; //for ranking (4th:-3, 3rd:-2, 2nd:-1, 1st:0)
						return true;
					}
					player.statusVisibility = Game.statusVisibilityLimit;
				}
				InitializePlayer(player,false);
			}
		}
	}
	return false;
}
function CircleOverlap(distanceX, distanceY, radius){ //(slightly) optimized circle collision
	distanceX = Math.abs(distanceX);
	distanceY = Math.abs(distanceY);
	
	if(distanceX+distanceY <= radius) //inside square diamond
		return true;
	if(Math.pow(distanceX,2)+Math.pow(distanceY,2) <= Math.pow(radius,2)) //inside circle
		return true;
	
	return false;
}
function CreateColVectors(ball){
	let radius = ball.ballRadius;
	
	ballY = Math.floor(radius*ball.Ydirection+radius);
	ballX = Math.floor(radius*ball.Xdirection+radius);
	
	let endY = Math.floor(radius*(-ball.Ydirection)+radius);
	let endX = Math.floor(radius*(-ball.Xdirection)+radius);
	
	let Ystep = (ballY<endY) ? 1 : -1; //or Math.sign(endY - ballY)
	let Xstep = (ballX<endX) ? 1 : -1; //or Math.sign(endX - ballX)
	
	let Ydir = -Math.abs(endY - ballY);
	let Xdir = Math.abs(endX - ballX);
	
	let dirError = Xdir+Ydir;
	
	ball.Vectors = [];
	ball.Vectors.push([]);
	ball.Vectors[0].push({x:ballX,y:ballY,index:0});
	
	let blockCount = 1;
	
	while(ballX !== endX || ballY !== endY){ //Bresenham's line algorithm
		let dirError2 = dirError*2;
		if(dirError2 >= Ydir){
			ballX+=Xstep;
			dirError+=Ydir;
		}
		if(dirError2 <= Xdir){
			ballY+=Ystep;
			dirError+=Xdir;
		}
		
		ball.Vectors[0].push({x:ballX,y:ballY,index:blockCount});
		blockCount++;
	}
	
	let blockIndex = 0;
	let vectorIndex = 1;
	let refVectorIndex = 0;
	ball.Vectors.push([]);
	let flip = false;
	let repeatBlock = true;
	let UpDownFlip = Math.abs(ball.Xdirection) > Math.abs(ball.Ydirection);
	let newX=0;
	let newY=0;
	let ballNotFull = false;
	blockCount = 0;
	do{ //filling ball with vectors
		refVectorIndex = Math.max(0,vectorIndex-2);
		let block = ball.Vectors[refVectorIndex][blockIndex];
		ballX = block.x;
		ballY = block.y;
		
		if(UpDownFlip){
			if(repeatBlock)
				newX = (blockIndex===0) ? ballX-Xstep : ballX+Xstep;
			else
				newX = ballX;
		} else
			newX = (flip) ? (ballX-1) : (ballX+1);
		
		if(UpDownFlip)
			newY = (flip) ? (ballY-1) : (ballY+1);
		else {
			if(repeatBlock)
				newY = (blockIndex===0) ? ballY-Ystep : ballY+Ystep;
			else
				newY = ballY;
		}
		
		if(CircleOverlap(newX-radius, newY-radius, radius+1)){
			if(ball.Vectors.length-1 < vectorIndex)
				ball.Vectors.push([]);
			ball.Vectors[vectorIndex].push({x:newX,y:newY,index:blockCount});
			blockCount++;
			
			ballNotFull = true;
		}
		
		if(blockIndex >= ball.Vectors[refVectorIndex].length-1 && ballNotFull){
			if(repeatBlock){
				blockIndex=0;
				vectorIndex++;
				flip = !flip;
				ballNotFull = false;
				blockCount = 0;
			} else
				repeatBlock = true;
		} else {
			if(repeatBlock)
				repeatBlock = false;
			else
				blockIndex++;
		}
	} while(ballNotFull || blockIndex < ball.Vectors[refVectorIndex].length);
}
function SetClipPixel(object, x, y, level=null){
	let collided = (level===null) ? object.collided : object.collided[level];
	if(!collided){
		object.render.save();
		object.render.beginPath();
		if(level===null) object.collided = true;
		else object.collided[level] = true;
	}
	object.render.rect(x,y,1,1);
}
function BallBallCollision(ball1,ball2){
	let ball2Y = ball2.ballPosY+ball2.ballRadius;
	let ball2X = ball2.ballPosX+ball2.ballRadius;
	if(!CircleOverlap(ball2X-ballX, ball2Y-ballY, ball2.ballRadius+ball1.ballRadius+1))
		return;
	for(let ballVector1 of ball1.Vectors){
		if(ballVector1.length===0) //if empty ballVector has not been removed yet
			continue;
		if(ball2.isMoving){
			for(let ballVector2 of ball2.Vectors){
				let bX1 = ballVector1[0].x, bX2 = ballVector1[ballVector1.length-1].x;
				let b2X1 = ballVector2[0].x, b2X2 = ballVector2[ballVector2.length-1].x;
				let bXmin = Math.min(bX1,bX2)+ball1.ballPosX;
				let bXmax = Math.max(bX1,bX2)+ball1.ballPosX;
				let b2Xmin = Math.min(b2X1,b2X2)+ball2.ballPosX;
				let b2Xmax = Math.max(b2X1,b2X2)+ball2.ballPosX;
				let xOverlap = (bXmin <= b2Xmax) && (b2Xmin <= bXmax);
				
				let bY1 = ballVector1[0].y, bY2 = ballVector1[ballVector1.length-1].y;
				let b2Y1 = ballVector2[0].y, b2Y2 = ballVector2[ballVector2.length-1].y;
				let bYmin = Math.min(bY1,bY2)+ball1.ballPosY;
				let bYmax = Math.max(bY1,bY2)+ball1.ballPosY;
				let b2Ymin = Math.min(b2Y1,b2Y2)+ball2.ballPosY;
				let b2Ymax = Math.max(b2Y1,b2Y2)+ball2.ballPosY;
				let yOverlap = (bYmin <= b2Ymax) && (b2Ymin <= bYmax);
				
				if(xOverlap && yOverlap){ //vector-vector (line-line) collision
					while(ballVector1.length > 0){
						let levelInfo = UpdateLevelData(ball1.level,ballLevelX+ballVector1[0].x,ballLevelY+ballVector1[0].y);
						ball1.level = levelInfo.level;
						let levelX = levelInfo.levelX;
						let levelY = levelInfo.levelY;
						
						if(levelX >= 0 && levelX < Terrain.canvas.width && levelY >= 0 && levelY < Terrain.canvas.height){ //pos is in bounds
							let levelPixel = levelY*Terrain.canvas.width+levelX;
							
							SetLevelColData(levelPixel,true);
							
							SetClipPixel(Terrain, levelX, levelY, ball1.level);
						}
						
						SetClipPixel(ball1, ballVector1[0].x, ballVector1[0].y);
						
						ballVector1.splice(0,1); //removing empty block
					}
					break;
				}
			}
		} else { //ball-shield
			for(let i = 0; i < ballVector1.length; i+=Game.updateInterval){
				let ballBlockY = ball1.ballPosY+ballVector1[i].y;
				let ballBlockX = ball1.ballPosX+ballVector1[i].x;
				if(CircleOverlap(ball2X-ballBlockX, ball2Y-ballBlockY, ball2.ballRadius)){
					ball2.hitCount+=1;
					if(ball2.hitCount >= ball2.hitLimit){
						if(Game.mode===GameMode.adventure)
							ChargeShot(1, ball2);
						else
							ChargeShot(-1, ball2);
						ball2.hitCount=0;
					}
					
					SetClipPixel(ball1, ballVector1[i].x, ballVector1[i].y);
					
					ballVector1.splice(i,1); //removing empty block
					i-=Game.updateInterval;
				}
			}
		}
	}
}
function BallPlayerCollision(ball,player){
	let playerY = player.playerPosY+player.playerRadius;
	let playerX = player.playerPosX+player.playerRadius;
	if(!CircleOverlap(playerX-ballX, playerY-ballY, player.playerRadius+ball.ballRadius+1))
		return false;
	for(let ballVector of ball.Vectors){
		for(let i = 0; i < ballVector.length; i+=Game.updateInterval){
			let ballBlockY = ball.ballPosY+ballVector[i].y;
			let ballBlockX = ball.ballPosX+ballVector[i].x;
			if(CircleOverlap(playerX-ballBlockX, playerY-ballBlockY, player.playerRadius)){
				SetClipPixel(ball, ballVector[i].x, ballVector[i].y);
				
				ballVector.splice(i,1); //removing empty block
				i-=Game.updateInterval;
				
				if(PlayerHit(player, ball.player))
					return true;
			}
		}
	}
	return false;
}
function BallTerrainCollision(ball,ballPosDiff){
	let blockStep = (ball.firstColCheck) ? Game.updateInterval : 1;
	for(let ballVector of ball.Vectors){
		let ballPosStep = 0;
		for(let i = 0; i < ballVector.length; i+=blockStep){
			if(!ball.firstColCheck){
				ballPosStep++;
				if(ballPosStep>ballPosDiff) //diagonal vectors have less pixels per distance, so ballPosDiff is unnecessarily long for those vectors (not a big deal tho)
					break;
			}
			let levelInfo = UpdateLevelData(ball.level,ballLevelX+ballVector[i].x,ballLevelY+ballVector[i].y);
			ball.level = levelInfo.level;
			let levelX = levelInfo.levelX;
			let levelY = levelInfo.levelY;
			
			let outOfBounds = false;
			let levelPixel = -1;
			if(levelX < 0 || levelX >= Terrain.canvas.width || levelY < 0 || levelY >= Terrain.canvas.height){
				if(!Game.noBounds){
					outOfBounds = true;
					levelY = Clamp(levelY, 0, Terrain.canvas.height-1); //Clamping Y-position in bounds
					levelX = Clamp(levelX, 0, Terrain.canvas.width-1); //Clamping X-position in bounds
					levelPixel = levelY*Terrain.canvas.width+levelX;
				}
			} else
				levelPixel = levelY*Terrain.canvas.width+levelX;
			
			if(GetLevelColData(levelPixel)!==0 || outOfBounds){ //if ball hits level-terrain or is out of bounds
				if(Game.noPile){
					SetLevelColData(levelPixel,false);
					Terrain.render.clearRect(levelX, levelY, 1, 1 ); //removing a pixel from contactpoint
					
					if(outOfBounds){
						SetClipPixel(ball, ballVector[i].x, ballVector[i].y);
						
						ballVector.splice(i,1);
						i--;
					}
					continue;
				}
				let blockCounter = ballVector[i].index;
				while(i < ballVector.length){
					if(ballVector[i].index!==blockCounter) //there's a gap in the vector
						break;
					
					blockCounter++;
					
					levelInfo = UpdateLevelData(ball.level,ballLevelX+ballVector[i].x,ballLevelY+ballVector[i].y);
					ball.level = levelInfo.level;
					levelX = levelInfo.levelX;
					levelY = levelInfo.levelY;
					
					if(levelX >= 0 && levelX < Terrain.canvas.width && levelY >= 0 && levelY < Terrain.canvas.height){ //pos is in bounds
						levelPixel = levelY*Terrain.canvas.width+levelX;
						
						SetLevelColData(levelPixel,true);
						
						SetClipPixel(Terrain, levelX, levelY, ball.level);
					}
					SetClipPixel(ball, ballVector[i].x, ballVector[i].y);
					
					ballVector.splice(i,1); //removing empty block
				}
				break;
			}
		}
	}
}
function PlayerTerrainCollision(player){
	player.onGround = false;
	Terrain.ResetCollided();
	
	for(let i = 0; i < player.colPoints.length; i++){
		let blockX = player.colPoints[i].x;
		let blockY = player.colPoints[i].y;
		
		let levelInfo = UpdateLevelData(player.level,Math.floor(player.playerPosX-levelPosX+blockX),Math.floor(player.playerPosY-levelPosY+blockY));
		player.level = levelInfo.level;
		let levelX = levelInfo.levelX;
		let levelY = levelInfo.levelY;
		
		let levelPixel = -1;
		let outOfBounds = false;
		
		if(levelX>=0 && levelX<Terrain.canvas.width && levelY>=0 && levelY<Terrain.canvas.height) //in bounds
			levelPixel = levelY*Terrain.canvas.width+levelX;
		else if(!Game.noBounds){ //out of bounds
			outOfBounds = true;
			if(levelX < -player.colMiddle){
				player.playerPosX -= levelX;
				player.momentumX = Math.max(player.momentumX,0);
			} else if(levelX >= Terrain.canvas.width+player.colMiddle){
				player.playerPosX -= levelX-(Terrain.canvas.width-1);
				player.momentumX = Math.min(player.momentumX,0);
			} if(levelY < -player.colMiddle){
				player.playerPosY -= levelY;
				player.momentumY = Math.max(player.momentumY,0);
			} else if(levelY >= Terrain.canvas.height+player.colMiddle){
				player.playerPosY -= levelY-(Terrain.canvas.height-1);
				player.momentumY = Math.min(player.momentumY,0);
			}
		}
		if(GetLevelColData(levelPixel)!==0 || outOfBounds){ //if player hits level-terrain
			if(blockY < player.colMiddle){ //pixels from halfway upwards
				if(blockY < player.colTop){
					if(player.momentumY<0){
						player.momentumY = Math.min(player.momentumY+Game.momentumChange*4,0);
						player.onGround = true;
					}
					
					if(!Game.infiniteJump)
						player.jumpTimer = Game.jumpLimit;
					
					player.playerPosY += Game.positionCorrection;
				} else {
					player.momentumX += (blockX<player.colMiddle) ? Game.momentumChange : -Game.momentumChange;
					player.momentumY += Game.momentumChange;
					//alternative
					//player.momentumX -= (blockX-player.colMiddle)/player.colMiddle*Game.momentumChange;
					//player.momentumY -= (blockY-player.colMiddle)/player.colMiddle*Game.momentumChange;
				}
			} else { //pixels from halfway downwards
				if(blockY > player.colBottom){
					player.onGround = true;
					player.jumpTimer = 0;
					if(player.momentumY>0)
						player.momentumY = Math.max(player.momentumY-Game.momentumChange*4,0);
					
					if(player.momentumX===0)
						player.rotMomentum = 0;
					
					player.playerPosY -= Game.positionCorrection;
				} else {
					if(Game.wallJump && !outOfBounds)
						player.jumpTimer = 0;
					
					player.momentumX += (blockX<player.colMiddle) ? Game.momentumChange : -Game.momentumChange;
					player.momentumY -= Game.momentumChange;
					//alternative (player slows down when going up slopes)
					//player.momentumX -= (blockX-player.colMiddle)/player.colMiddle*Game.momentumChange;
					//player.momentumY -= (blockY-player.colMiddle)/player.colMiddle*Game.momentumChange;
				}
			}
			if((Game.collectCharge || !player.charging) && !player.chargeHold){ //OR "if((Game.collectCharge && !player.chargeHold) || !player.charging)"?
				if(player.rotMomentum!==0 && !outOfBounds){ //can't collect snow without rotating
					if(!Game.noGrow){
						if(!Terrain.collided[player.level]){
							let xOffset = 0;
							let yOffset = 0;
							if(Game.mode===GameMode.adventure){
								xOffset = Levels[player.level].xOffset;
								yOffset = Levels[player.level].yOffset;
							}
							player.render.drawImage(Terrain.canvas,
							Math.floor(levelPosX-player.playerPosX+xOffset), //xOffset is always 0 in battleMode
							Math.floor(levelPosY-player.playerPosY+yOffset)); //yOffset is always 0 in battleMode
							Terrain.collided[player.level] = true;
						}
						player.pixelCount += Math.ceil(Game.speedMultiplier/2); //collects snow faster
						snowRate = SnowRate(1.002,0.05);
						if(player.pixelCount >= player.pixelCountMax) //how many pixels needs to be collected before growth
							ChangeSize(1,player);
					}
					if(!Game.noCollect){
						Terrain.render.clearRect(levelX, levelY, 1, 1 ); //removing a pixel from contactpoint
						SetLevelColData(levelPixel,false); //alternative: Terrain.colData[Terrain.pixelIndex] &= ~Terrain.pixelMask;
					}
				}
			}
		}
	}
}
function CheckPlayerInsideTerrain(player,posDiffX,posDiffY){
	let posDiffSum = Math.hypot(posDiffX,posDiffY);
	let playerPosDiff = Math.floor(posDiffSum);
	
	if(playerPosDiff <= Game.maxSpeed) //speed threshold (using maxSpeed because maxDropSpeed is too high)
		return;
	
	let posDirX = posDiffX/posDiffSum;
	let posDirY = posDiffY/posDiffSum;
	
	while(playerPosDiff>0){
		let blockX = player.colMiddle; //-posDirX*player.colMiddle+player.colMiddle
		let blockY = player.colMiddle; //-posDirY*player.colMiddle+player.colMiddle
		
		let levelInfo = UpdateLevelData(player.level,Math.floor(player.playerPosX-levelPosX+blockX),Math.floor(player.playerPosY-levelPosY+blockY));
		player.level = levelInfo.level;
		let levelX = levelInfo.levelX;
		let levelY = levelInfo.levelY;
		
		let levelPixel = -1;
		let outOfBounds = false;
		
		if(levelX>=0 && levelX<Terrain.canvas.width && levelY>=0 && levelY<Terrain.canvas.height) //in bounds
			levelPixel = levelY*Terrain.canvas.width+levelX;
		else if(!Game.noBounds) //out of bounds
			outOfBounds = true;
		
		if(GetLevelColData(levelPixel)===0 && !outOfBounds)
			break;
		
		player.playerPosX -= posDirX;
		player.playerPosY -= posDirY;
		player.momentumX -= posDirX; //or player.momentumX = 0?
		player.momentumY -= posDirY; //or player.momentumY = 0?
		playerPosDiff--;
	}
}
function GameLogic(){
for(let step = Game.steps; step >= 1; step--){
	for(let player of IngamePlayers){
		if(player.left){
			if(Game.noClip)
				player.playerPosX -= Game.maxSpeed*player.leftValue;
			else if(player.momentumX > -Game.maxSpeed*player.leftValue) //can go faster with knockBack
				player.momentumX = Math.max(player.momentumX-Game.acceleration,-Game.maxSpeed*player.leftValue);
		}
		if(player.right){
			if(Game.noClip)
				player.playerPosX += Game.maxSpeed*player.rightValue;
			else if(player.momentumX < Game.maxSpeed*player.rightValue) //can go faster with knockBack
				player.momentumX = Math.min(player.momentumX+Game.acceleration,Game.maxSpeed*player.rightValue);
		}
		if(player.jump){
			if(player.momentumY > Game.jumpForce){
				if(!Game.infiniteJump){
					player.jumpTimer += Game.speedMultiplier; //or +=Game.updateInterval?
					if(player.jumpTimer >= Game.jumpLimit){
						if(!Game.wallJump)
							player.jump = false;
						player.jumpTimer = Game.jumpLimit;
					}
				} else
					player.jumpTimer = 0;
				
				if(player.jumpTimer < Game.jumpLimit)
					player.momentumY = Game.jumpForce;
			}
		}
		if(player.onGround){
			if(player.momentumX < 0)
				player.momentumX = Math.min(player.momentumX+Game.friction,0);
			else if(player.momentumX > 0)
				player.momentumX = Math.max(player.momentumX-Game.friction,0);
		}
		if(player.invulnerability > 0)
			player.invulnerability -= Game.speedMultiplier; //or -=Game.updateInterval (so gameSpeed doesn't affect time)
		if(player.statusVisibility > 0)
			player.statusVisibility -= Game.speedMultiplier; //or -=Game.updateInterval (so gameSpeed doesn't affect time)
		if(player.up){
			if(Game.noClip)
				player.playerPosY -= Game.maxSpeed*player.upValue;
		} else if(player.down){
			if(Game.noClip)
				player.playerPosY += Game.maxSpeed*player.downValue;
		}
		let ball = (player.Balls.length > 0) ? player.Balls[player.Balls.length-1] : null;
		if(player.charging){
			if(player.sizeLevel>0 && !player.chargeHold){
				if(ball === null || ball.isMoving)
					ball = CreateShot(player);
				
				if(Game.instantCharge){
					ChargeShot(player.sizeLevel/2, ball);
					ChangeSize(-player.sizeLevel/2, player);
				} else {
					player.chargeCount += player.chargeValue*Game.speedMultiplier; //or *Game.updateInterval?
					let chargeAmount = Math.floor(Math.min(player.chargeCount/Game.chargeInterval,player.sizeLevel/2));
					if(chargeAmount>=1){
						ChargeShot(chargeAmount, ball);
						ChangeSize(-chargeAmount, player);
						player.chargeCount -= chargeAmount*Game.chargeInterval;
					}
				}
				LoopSound(player.Sounds.charge,player.chargeValue);
			} else
				LoopSound(player.Sounds.charge,0);
			if(ball !== null && !ball.isMoving){
				//calculating the aiming direction
				if(!player.aimCentered){
					ball.Xdirection = player.aimX-player.playerPosX-player.playerRadius;
					ball.Ydirection = player.aimY-player.playerPosY-player.playerRadius;
				} else { //drag ball behind the player
					ball.Xdirection = -player.momentumX;
					if(Math.abs(player.momentumY) > Game.momentumThreshold*20)
						ball.Ydirection = -player.momentumY;
					else
						ball.Ydirection = Math.abs(player.momentumY); //shoots downwards
				}
				let positionSum = Math.hypot(ball.Xdirection,ball.Ydirection);
				if(positionSum>0){
					ball.Xdirection = ball.Xdirection/positionSum;
					ball.Ydirection = ball.Ydirection/positionSum;
				} else {
					ball.Xdirection = 0;
					ball.Ydirection = 1; //shoots downwards as a failsafe
				}
			}
		} else if(ball !== null && !ball.isMoving){
			StopLoop(player.Sounds.charge);
			
			if(ball.ballSize>0){
				CreateColVectors(ball);
				
				if(!Game.noKnockback){
					let knockBackStrength = ball.ballSize*Game.knockBackForce*(Game.shotSpeed*Game.shotSpeed/25);
					player.momentumX -= ball.Xdirection*knockBackStrength;
					player.momentumY -= ball.Ydirection*knockBackStrength;
				}
				ball.isMoving = true;
				PlaySound(ball.Sounds.shot);
			} else {
				RemoveShot(ball);
			}
		}
		if(!player.onGround){
			if(player.momentumY < Game.maxDropSpeed) //can drop faster with knockBack
				player.momentumY = Math.min(player.momentumY+Game.dropAcceleration,Game.maxDropSpeed);
		}
		if(!Game.noClip){
			let prevPlayerPosX = player.playerPosX;
			let prevPlayerPosY = player.playerPosY;
			
			player.playerPosX += player.momentumX;
			player.playerPosY += player.momentumY;
			
			CheckPlayerInsideTerrain(player,player.playerPosX-prevPlayerPosX,player.playerPosY-prevPlayerPosY); //push player out of terrain (halfway)
			
			PlayerTerrainCollision(player);
		} else {
			if(Game.mode===GameMode.adventure) //update player.level even in noClip
				player.level = FindLevel(player.level,Math.floor(player.playerPosX-levelPosX+player.colMiddle),Math.floor(player.playerPosY-levelPosY+player.colMiddle));
			
			player.momentumX = 0;
			player.momentumY = 0;
			player.jumpTimer = 0;
			player.onGround = false;
		}
		if(player.momentumX!==0 || player.rotMomentum!==0){ //rotation render
			if(player.onGround){
				if(Math.abs(player.momentumX) < Game.momentumThreshold)
					player.rotMomentum = 0;
				else {
					player.rotMomentum = player.momentumX;
					player.rotMomentum += Math.sign(player.momentumX)*Math.abs(player.momentumY); //Y-momentum adds some extra rotation
				}
			} else {
				if(player.rotMomentum!==0)
					player.rotMomentum -= Math.sign(player.rotMomentum)*Game.momentumChange;
				if(Math.abs(player.rotMomentum) < Game.momentumThreshold)
					player.rotMomentum = 0;
			}
			if(player.rotMomentum!==0){
				player.render.setTransform(1, 0, 0, 1, 0, 0);
				tempCanvas.height = player.playerHeight;
				tempCanvas.width = player.playerWidth;
				tempRender.drawImage(player.canvas,0,0);
				player.render.translate(player.playerRadius,player.playerRadius);
				player.render.rotate(player.rotMomentum*degToRad);
				player.render.translate(-player.playerRadius,-player.playerRadius);
				player.render.drawImage(tempCanvas, 0, 0);
			}
		}
	}
	for(let p = 1; p < Players.length; p++){ //using Players instead of IngamePlayers so that shots won't disappear when a player loses all their lives
		let player = Players[p];
		if(!player.joined)
			continue;
		
		for(let b = 0; b < player.Balls.length; b++){
			let ball = player.Balls[b];
			if(!ball.isMoving)
				continue;
			
			Terrain.ResetCollided();
			
			let prevBallPosX = ball.ballPosX;
			let prevBallPosY = ball.ballPosY;
			
			ball.ballPosX += ball.Xdirection*(Game.ballSpeed*(Game.shotSpeed*Game.shotSpeed/25));
			ball.ballPosY += ball.Ydirection*(Game.ballSpeed*(Game.shotSpeed*Game.shotSpeed/25));
			
			let ballPosDiff = Math.ceil(Math.hypot(ball.ballPosX-prevBallPosX,ball.ballPosY-prevBallPosY))+1;
			
			//these are pre-calculated here so that they don't have to be recalculated multiple times in BallCollision-functions
			ballY = ball.ballPosY+ball.ballRadius;
			ballX = ball.ballPosX+ball.ballRadius;
			ballLevelY = Math.floor(ball.ballPosY-levelPosY);
			ballLevelX = Math.floor(ball.ballPosX-levelPosX);
			
			ball.collided = false;
			
			for(let op = 0; op < IngamePlayers.length; op++){
				let otherPlayer = IngamePlayers[op];
				if(otherPlayer.number===player.number)
					continue;
				
				if(BallPlayerCollision(ball,otherPlayer)){ //if GameOver or player dies
					if(Game.type===GameType.score){
						Results();
						return;
					}
					IngamePlayers.splice(op,1);
					op--;
					if(IngamePlayers.length<=1){
						Results();
						return;
					}
				}
				if(!Game.noPile)
					for(let ball2 of otherPlayer.Balls)
						BallBallCollision(ball,ball2);
			}
			
			BallTerrainCollision(ball,ballPosDiff);
			
			ball.firstColCheck = false;
			if(ball.collided){
				snowRate = SnowRate(1.02,0.5);
				let collidedLength = Game.mode===GameMode.adventure ? Terrain.collided.length : 1;
				for(let l = 0; l < collidedLength; l++){
					if(Terrain.collided[l]){
						let xOffset = 0;
						let yOffset = 0;
						if(Game.mode===GameMode.adventure){
							xOffset = Levels[l].xOffset;
							yOffset = Levels[l].yOffset;
							Terrain.render = Levels[l].render;
						}
						Terrain.render.clip();
						Terrain.render.drawImage(ball.canvas,ballLevelX-xOffset,ballLevelY-yOffset);
						Terrain.render.restore();
					}
				}
				ball.render.clip();
				ball.render.clearRect(0,0,ball.canvas.width,ball.canvas.height);
				ball.render.restore();
				
				for(let v = 0; v < ball.Vectors.length; v++){ //removing empty vectors
					if(ball.Vectors[v].length===0){
						ball.Vectors.splice(v,1);
						v--;
					}
				}
				if(ball.Vectors.length===0){ //all vectors collided
					RemoveShot(ball);
					b--;
				}
			}
		}
	}
	snowRate = SnowRate(0.98,0);
}
	LoopSound(Sounds.snow,snowRate);
	RenderGame();
}
function RenderGame(){
	if(Game.fixedCamera){
		let xOffset = 0;
		let yOffset = 0;
		let areaCanvas = Terrain.canvas;
		if(Game.mode===GameMode.adventure){
			let level = Levels[Players[firstJoined].level];
			xOffset = level.xOffset;
			yOffset = level.yOffset;
			areaCanvas = level.canvas;
		}
		areaScale = Math.min(Screen.width/areaCanvas.width,Screen.height/areaCanvas.height);
		let levelOffsetX = (Screen.width/areaScale-areaCanvas.width)/2-xOffset;
		let levelOffsetY = (Screen.height/areaScale-areaCanvas.height)/2-yOffset;
		for(let p = 1; p < Players.length; p++){
			if(!Players[p].joined)
				continue;
			
			for(let ball of Players[p].Balls){
				ball.ballPosX -= levelPosX-levelOffsetX;
				ball.ballPosY -= levelPosY-levelOffsetY;
			}
			Players[p].playerPosX -= levelPosX-levelOffsetX;
			Players[p].playerPosY -= levelPosY-levelOffsetY;
		}
		levelPosX = levelOffsetX;
		levelPosY = levelOffsetY;
	} else {
		let minX=0,minY=0,maxX=0,maxY=0;
		let momX=[],momY=[],avgMomX=0,avgMomY=0;
		for(let p = 0; p < IngamePlayers.length; p++){ //finding the middlepoint between players
			let player = IngamePlayers[p];
			
			if(p===0){
				minX = player.playerPosX;
				maxX = player.playerPosX+player.playerWidth;
				minY = player.playerPosY;
				maxY = player.playerPosY+player.playerHeight;
			} else {
				minX = Math.min(player.playerPosX,minX);
				maxX = Math.max(player.playerPosX+player.playerWidth,maxX);
				minY = Math.min(player.playerPosY,minY);
				maxY = Math.max(player.playerPosY+player.playerHeight,maxY);
			}
			momX.push(player.momentumX);
			momY.push(player.momentumY);
		}
		avgMomX = momX.reduce((sum, val) => sum + val)/momX.length;
		avgMomY = momY.reduce((sum, val) => sum + val)/momY.length;
		/*if(!noCameraBounds){
			let newAreaScale1 = Math.min(Screen.width,Screen.height)/(Math.min(Terrain.canvas.width,Terrain.canvas.height)/2);
			let newAreaScale2 = (Screen.width*Game.aimMargin)/Math.min((maxX-minX),Terrain.canvas.width*Game.aimMargin);
			let newAreaScale3 = (Screen.height*Game.aimMargin)/Math.min((maxY-minY),Terrain.canvas.height*Game.aimMargin);
			areaScale = AnimateValue(areaScale,Math.min(newAreaScale1,newAreaScale2,newAreaScale3),areaScaleAnimForce);
		} else {*/
		let newAreaScale1 = Math.min(Screen.width,Screen.height)/Game.aimArea;
		let newAreaScale2 = (Screen.width*Game.aimMargin)/(maxX-minX);
		let newAreaScale3 = (Screen.height*Game.aimMargin)/(maxY-minY);
		areaScale = AnimateValue(areaScale,Math.min(newAreaScale1,newAreaScale2,newAreaScale3),areaScaleAnimForce);
		
		middleOffsetX = AnimateValue(middleOffsetX,avgMomX*Game.panMultiplier/Game.speedMultiplier,areaScaleAnimForce);
		middleOffsetY = AnimateValue(middleOffsetY,avgMomY*Game.panMultiplier/Game.speedMultiplier,areaScaleAnimForce);
		let playersCenterX = (minX+maxX)/2+middleOffsetX;
		let playersCenterY = (minY+maxY)/2+middleOffsetY;
		
		let scaledMiddlePointX = Screen.width/2/areaScale; //middlePoint/areaScale converts screen center to logical center
		let scaledMiddlePointY = Screen.height/2/areaScale;
		
		let xPositionChange = scaledMiddlePointX-playersCenterX;
		let yPositionChange = scaledMiddlePointY-playersCenterY;
		
		/*if(!noCameraBounds){
			if(Terrain.canvas.width*areaScale > Screen.width){
				if(levelPosX+xPositionChange > 0)
					xPositionChange -= levelPosX+xPositionChange;
				else if(levelPosX+xPositionChange < Screen.width/areaScale-Terrain.canvas.width)
					xPositionChange -= (levelPosX+xPositionChange)-(Screen.width/areaScale-Terrain.canvas.width);
			} else
				xPositionChange -= (levelPosX+xPositionChange)-(Screen.width/areaScale-Terrain.canvas.width)/2;
			if(Terrain.canvas.height*areaScale > Screen.height){
				if(levelPosY+yPositionChange > 0)
					yPositionChange -= levelPosY+yPositionChange;
				else if(levelPosY+yPositionChange < Screen.height/areaScale-Terrain.canvas.height)
					yPositionChange -= (levelPosY+yPositionChange)-(Screen.height/areaScale-Terrain.canvas.height);
			} else
				yPositionChange -= (levelPosY+yPositionChange)-(Screen.height/areaScale-Terrain.canvas.height)/2;
		}*/
		levelPosX += xPositionChange;
		levelPosY += yPositionChange;
		for(let p = 1; p < Players.length; p++){
			if(!Players[p].joined)
				continue;
			
			for(let ball of Players[p].Balls){
				ball.ballPosX += xPositionChange;
				ball.ballPosY += yPositionChange;
			}
			Players[p].playerPosX += xPositionChange;
			Players[p].playerPosY += yPositionChange;
		}
	}
	for(let player of IngamePlayers){
		Aim(player); //update AimX/Y
		if(player.Balls.length > 0){
			let ball = player.Balls[player.Balls.length-1];
			if(!ball.isMoving){
				ball.ballPosX = player.playerPosX+player.playerRadius+(ball.Xdirection*(ball.ballRadius+player.playerRadius))-ball.ballRadius;
				ball.ballPosY = player.playerPosY+player.playerRadius+(ball.Ydirection*(ball.ballRadius+player.playerRadius))-ball.ballRadius;
			}
		}
	}
	//Rendering everything
	if(!Game.noBounds){
		gameRender.fillStyle = "#00000020"; //Out of bounds area color
		gameRender.fillRect(0, 0, Screen.width, Screen.height); //Out of bounds area
	}
	
	if(Game.mode===GameMode.adventure){
		for(let level of Levels){ //floor(pos) and ceil(size) prevent vertical lines (Out of bounds area color)
			let scaledLevelPosX = Math.floor((levelPosX+level.xOffset)*areaScale), scaledLevelPosY = Math.floor((levelPosY+level.yOffset)*areaScale);
			let scaledLevelWidth = Math.ceil(level.canvas.width*areaScale), scaledLevelHeight = Math.ceil(level.canvas.height*areaScale);
			if(scaledLevelPosX<Screen.width && scaledLevelPosX+scaledLevelWidth>0 && scaledLevelPosY<Screen.height && scaledLevelPosY+scaledLevelHeight>0){ //off-screen canvases are not rendered
				gameRender.clearRect(scaledLevelPosX, scaledLevelPosY, scaledLevelWidth, scaledLevelHeight);
				gameRender.drawImage(level.canvas,0,0,level.canvas.width,level.canvas.height,scaledLevelPosX,scaledLevelPosY,scaledLevelWidth,scaledLevelHeight);
			}
		}
	} else {
		let scaledLevelPosX = levelPosX*areaScale, scaledLevelPosY = levelPosY*areaScale;
		let scaledLevelWidth = Terrain.canvas.width*areaScale, scaledLevelHeight = Terrain.canvas.height*areaScale;
		
		gameRender.clearRect(scaledLevelPosX, scaledLevelPosY, scaledLevelWidth, scaledLevelHeight);
		gameRender.drawImage(Terrain.canvas,0,0,Terrain.canvas.width,Terrain.canvas.height,scaledLevelPosX,scaledLevelPosY,scaledLevelWidth,scaledLevelHeight);
	}
	
	if(IngamePlayers.length>1){
		guiRender.lineWidth = 3;
		guiRender.setLineDash([]);
	}
	for(let player of IngamePlayers){
		if(player.invulnerability > 0)
			gameRender.globalAlpha = 0.5;
		gameRender.drawImage(player.canvas,0,0,player.playerWidth,player.playerHeight,player.playerPosX*areaScale,player.playerPosY*areaScale,player.playerWidth*areaScale,player.playerHeight*areaScale);
		gameRender.globalAlpha = 1;
		if(IngamePlayers.length>1){
			guiRender.beginPath();
			guiRender.arc((player.playerPosX+player.playerRadius)*areaScale/Screen.guiScale,(player.playerPosY+player.playerRadius)*areaScale/Screen.guiScale,(player.playerRadius)*areaScale/Screen.guiScale,0,2*Math.PI);
			guiRender.strokeStyle = PlayerColor[player.number].color;
			guiRender.stroke();
		}
	}
	for(let p = 1; p < Players.length; p++){
		let player = Players[p];
		if(!player.joined)
			continue;
		
		for(let ball of player.Balls)
			gameRender.drawImage(ball.canvas,0,0,ball.canvas.width,ball.canvas.height,ball.ballPosX*areaScale,ball.ballPosY*areaScale,ball.canvas.width*areaScale,ball.canvas.height*areaScale);
	}
	guiRender.lineWidth = 3;
	guiRender.setLineDash([5,10]);
	for(let player of IngamePlayers){
		if(!player.aimCentered){
			guiRender.beginPath();
			guiRender.moveTo((player.playerPosX+player.playerRadius)*areaScale/Screen.guiScale,(player.playerPosY+player.playerRadius)*areaScale/Screen.guiScale);
			guiRender.lineTo(player.aimX*areaScale/Screen.guiScale,player.aimY*areaScale/Screen.guiScale);
			guiRender.strokeStyle = PlayerColor[player.number].color;
			guiRender.stroke();
			let crossOffsetX = Crosshair[player.number].xOffset;
			let crossOffsetY = Crosshair[player.number].yOffset;
			guiRender.drawImage(Crosshair[player.number],(player.aimX*areaScale/Screen.guiScale)-crossOffsetX,(player.aimY*areaScale/Screen.guiScale)-crossOffsetY);
		}
	}
	if(Game.mode===GameMode.battle){
		for(let player of IngamePlayers){
			if(player.statusVisibility > 0){
				guiRender.fillStyle = PlayerColor[player.number].color;
				guiRender.font = Math.max(player.playerHeight*areaScale,30)+"px Arial";
				guiRender.textAlign = "center";
				guiRender.fillText(((Game.type===GameType.score) ? player.score : player.lives),(player.playerPosX+player.playerRadius)*areaScale/Screen.guiScale,player.playerPosY*areaScale/Screen.guiScale);
			}
		}
	}
}
const logo = [
[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,0,0,0,1,0,1,1,1,0,0,1,1,1,0,1,0,0,0,1,0,0,0,0,0,1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,0,1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,1,0,0,1,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1,1,0,0,1,0,0,1,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,1,1,1,1,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,1,1,1,0,1,0,0,0,1,1,1,1,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,0,1,0,1,0,0,1,0,0,1,1,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,1,1,1,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,0,1,0,0,1,1,0,0,0,0,0,1,0,0,1,1,0,0,0,0,0,0,1,0,0,1,0,0,1,1,1,0,1,0,0,0,0,1,1,1,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1]
];
const adventureText = [
[0,1,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,1,0,0,1,1,0,1,0,1,0,0,1,0,0,1,1,0,0,1,1,1,0,1,0,1,0,1,1,1,0,0,1,0],
[1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,1,0,0,1,0,1],
[1,0,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,0,0,1,1,1],
[1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0,0,1,0,1,0,0,1,1,0,0,1,1,0,1,0,0,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
];
const startText = [
[0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,0,0,1,1,1,0,0,1,1,0,1,1,1,0,1,1,1],
[0,1,0,0,0,1,0,0,1,0,1,0,1,1,0,0,0,1,0],
[0,0,1,0,0,1,0,0,1,1,1,0,1,0,0,0,0,1,0],
[1,1,0,0,0,1,1,0,1,0,1,0,1,0,0,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const battleText = [
[1,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,0,0],
[1,0,1,0,0,1,1,0,1,1,1,0,1,1,1,0,1,0,0,1,0],
[1,1,1,0,1,0,1,0,0,1,0,0,0,1,0,0,1,0,1,0,1],
[1,0,1,0,1,1,1,0,0,1,0,0,0,1,0,0,1,0,1,1,1],
[1,1,0,0,1,0,1,0,0,1,1,0,0,1,1,0,1,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
];
const gameTypeText = [
[0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,0,0,1,1,0,1,1,1,1,0,0,0,1,0,0,0,0,1,1,1,0,1,0,1,0,1,1,0,0,0,1,0],
[1,0,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,0,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,0,0,0,1,0,0,1,1,1,0,1,0,1,0,1,1,1],
[0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,0,0,1,1,0,0,0,1,0,1,1,0,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,1,1]
];
const winScoreText = [
[1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,1,0,1,0,1,0,1,1,0,0,0,0,1,1,0,0,1,0,0,1,0,0,0,1,0,1,0,1],
[1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,1,0,0,1,1,1],
[1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,0],
[0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,1,0,0,1,0,0,1,0,0,1,0,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const lifeCountText = [
[1,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,0,1,0,0,1,0,0,1,0,1,0,1,1,0,0,1,1,1],
[1,0,0,0,1,0,1,1,0,0,1,1,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[1,0,0,0,1,0,1,0,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[1,1,1,0,1,0,1,0,0,0,0,1,1,0,0,0,0,1,0,0,1,0,0,0,1,1,0,1,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const shotSpeedText = [
[0,1,1,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1],
[1,0,0,0,1,1,0,0,0,1,0,0,1,1,1,0,0,0,1,1,0,1,1,0,0,1,0,1,0,1,0,1,0,0,1,1],
[0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1,0,1,0,1,1,1,0,1,1,1,0,1,0,1],
[0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,0,0,0,1,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1],
[1,1,0,0,1,0,1,0,0,1,0,0,0,1,1,0,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const infiniteJumpText = [
[1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,1,0,0,1,0,0,1,0,1,1,0,0,1,0,1,1,1,0,0,1,0,0,0,0,0,0,1,0,1,0,1,0,1,1,1,1,0,0,1,1,0],
[1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,0,1,1,1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0,0,0,0,0,0,1,0,0,0,1,1,0,1,0,1,0,1,0,1,1,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0]
];
const knockBackText = [
[1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
[1,1,0,1,0,0,1,0,0,0,0,1,0,1,0,1,1,0,0,0,1,0,0,0,1,0,1,0,1,0,1,1,0,0,0,1,1,0,0,1,0,1,0,1],
[1,1,1,1,0,1,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0],
[1,0,1,1,0,1,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0,0,1,0,1,0,1,1,1,0,1,0,0,1,1,0],
[1,0,0,1,0,0,1,0,0,0,0,1,0,1,0,1,0,1,0,0,1,0,0,0,1,0,1,0,1,0,1,1,0,0,1,0,1,0,0,1,0,1,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const instantChargeText = [
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,1,1,0,0,1,1,0,1,1,1,0,0,1,1,0,1,1,0,0,1,1,1,0,0,0,0,1,0,1,1,0,0,0,1,1,0,0,1,0,1,1,1,0,1,0,1],
[1,0,1,0,1,0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,1,1],
[1,0,1,0,1,0,0,1,0,0,1,0,0,1,1,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1,0,1,0,1,1,1,0,1,0,0,1,1,1,0,1,0,0],
[1,0,1,0,1,0,1,1,0,0,1,1,0,1,0,1,0,1,0,1,0,0,1,1,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0]
];
const fixedCameraText = [
[1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0,0,0,0,1,0,0,1,1,0,1,1,1,1,0,0,1,0,1,0,0,1,0,0,1,1],
[1,1,1,0,1,0,0,1,0,0,1,1,1,0,1,0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,0,1,0,1],
[1,0,0,0,1,0,1,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,1,1,0,1,0,1,0,1,0,1,0,0,0,1,0,0,1,1,1],
[1,0,0,0,1,0,1,0,1,0,0,1,1,0,0,1,1,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0,0,1,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const noPile1Text = [
[0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
[1,0,0,0,1,1,0,0,0,1,0,0,0,1,0,0,1,1,1,0,0,0,1,1,1,0,1,1,0,0,0,1,0,0,1,0,0,1,0,1,0,1,1,1,0,1,1,0],
[0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1],
[1,1,0,0,1,0,1,0,0,1,0,0,0,1,0,0,0,1,1,0,0,0,0,1,1,0,1,0,1,0,1,0,0,0,1,0,0,0,1,1,0,0,0,1,0,1,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0]
];
const noPile2Text = [
[0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,1,1,0,1,1,0,0,1,0,1,1,0,0,1,1,1],
[1,1,1,0,1,0,1,0,1,1,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,1,1],
[0,1,1,0,0,1,0,0,0,1,1,0,1,0,0,1,0,0,0,0,1,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0]
];
const stageSelectText = [
[0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,1,0],
[1,0,0,0,1,1,1,0,0,1,1,0,1,1,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,1,1],
[0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,1,1,0,0,0,0,1,0,0,1,1,1,0,1,0,1,1,1,0,1,0,0,0,1,0],
[0,0,1,0,0,1,0,0,1,1,1,0,1,1,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0],
[1,1,0,0,0,1,1,0,1,0,1,0,0,0,1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,1,0,0,1,1,0,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const optionsText = [
[0,1,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,1,0,1,1,0,0,1,1,1,0,1,0,0,1,0,0,1,1,0,0,1,1,0],
[1,0,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0],
[1,0,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,1,1,0,0,1,1,0,0,0,1,1,0,1,0,0,1,0,0,1,0,1,0,1,1,0],
[0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const soundVolumeText = [
[0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,0,1,0,0,1,0,1,0,1,1,0,0,0,1,1,0,0,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,1,1,1,1,0,0,0,1,0],
[0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1],
[1,1,0,0,0,1,0,0,0,1,1,0,1,0,1,0,0,1,1,0,0,0,0,1,0,0,0,1,0,0,1,0,0,1,1,0,1,0,1,0,1,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
];
const collisionQualityText = [
[0,1,1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],
[1,0,0,0,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,0,1,0,0,1,1,0,0,0,0,1,0,0,1,0,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1,0,1],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,1,0,1],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,1,1,0,1,0,1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,1,1],
[0,1,1,0,0,1,0,0,1,0,1,0,1,0,1,1,0,1,0,0,1,0,0,1,0,1,0,0,0,0,1,1,0,0,0,1,1,0,1,0,1,0,1,0,1,0,0,1,1,0,0,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0]
];
const resolutionText = [
[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,1,0,1,0,1,1,0,0,1,0,0,1,0,1,0,1,0,1,1,1,0,1,0,0,1,0,0,1,1,0],
[1,1,0,0,1,1,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1],
[1,0,1,0,1,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1],
[1,0,1,0,0,1,1,0,1,1,0,0,1,0,0,1,0,0,1,1,0,0,1,1,0,1,0,0,1,0,0,1,0,1]
];
const guiScaleText = [
[0,1,1,1,0,1,0,1,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0],
[1,0,0,0,0,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1,1,0,1,0,0,1,0],
[1,0,1,1,0,1,0,1,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1],
[1,0,0,1,0,1,0,1,0,1,0,0,0,0,1,0,1,0,0,1,1,1,0,1,0,1,1,1],
[0,1,1,1,0,0,1,1,0,1,0,0,1,1,0,0,0,1,0,1,0,1,0,1,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
];
const vsyncText = [
[1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,0,0,0,1,1,0,1,0,1,0,1,1,0,0,0,1,1],
[1,0,1,0,1,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0],
[1,0,1,0,0,0,0,0,1,0,1,1,1,0,1,0,1,0,1,0,0],
[0,1,0,0,0,0,0,1,1,0,0,0,1,0,1,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0]
];
const Adjust = [
[0,0,1,0,0,0,0,0,0,0,0,1,0,0],
[0,1,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,0,0,0,0,0,0,0,0,0,0,0,1],
[0,1,0,0,0,0,0,0,0,0,0,0,1,0],
[0,0,1,0,0,0,0,0,0,0,0,1,0,0]
];
const Enable = [
[1,0,0,0,1],
[0,1,0,1,0],
[0,0,1,0,0],
[0,1,0,1,0],
[1,0,0,0,1]
];
const Disable = [
[0,0,0,0,0],
[0,0,0,0,0],
[0,0,0,0,0],
[0,0,0,0,0],
[0,0,0,0,0]
];
const Plus = [
[0,0,0,0,0],
[0,0,1,0,0],
[0,1,1,1,0],
[0,0,1,0,0],
[0,0,0,0,0]
];
const Minus = [
[0,0,0,0,0],
[0,0,0,0,0],
[0,1,1,1,0],
[0,0,0,0,0],
[0,0,0,0,0]
];
const Numbers = [
[[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]], //Zero
[[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]], //One
[[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]], //Two
[[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]], //Three
[[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]], //Four
[[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]], //Five
[[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]], //Six
[[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]], //Seven
[[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]], //Eight
[[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]] //Nine
];
const upKeyText = [
[1,0,0,1,0,0,0,0],
[1,0,0,1,0,1,1,0],
[1,0,0,1,0,1,0,1],
[1,0,0,1,0,1,0,1],
[0,1,1,0,0,1,1,0],
[0,0,0,0,0,1,0,0]
];
const downKeyText = [
[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,1,0,0,1,0,0,1,0,0,0,1,0,1,1,0],
[1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,1,1,0,0,0,1,0,0,0,1,0,1,0,0,1,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const leftKeyText = [
[1,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,0,1,0,0,0,1,1,0,1,0],
[1,0,0,0,1,0,1,0,1,0,0,1,1,1],
[1,0,0,0,1,1,1,0,1,1,0,0,1,0],
[1,0,0,0,1,0,0,0,1,0,0,0,1,0],
[1,1,1,0,0,1,1,0,1,0,0,0,1,1]
];
const rightKeyText = [
[1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0],
[1,0,1,0,1,0,1,1,1,0,1,1,0,1,1,1],
[1,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0],
[1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0],
[1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,1],
[0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0]
];
const jumpKeyText = [
[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,1,0,1,0,1,0,1,1,1,1,0,0,1,1,0],
[0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,1,0,0,0,1,1,0,1,0,1,0,1,0,1,1,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0]
];
const chargeKeyText = [
[0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,1,1,0,0,0,1,1,0,0,1,0,1,1,1,0,0,1,0,0,0,0,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1,0,0,0,1,1,0,0,0,1,0,0,0,1,0,1,1,1],
[1,0,0,0,1,0,1,0,1,1,1,0,1,0,0,1,1,1,0,1,1,1,0,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
[0,1,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,1,0,1,0,0,0,1,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,0,0,1,0,0,0,1,0,0,1,1]
];
const chargeHoldKeyText = [
[1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,0,1,0,0,1,0,0,1,1,0,0,0,1,0,0,0,1,1,0,0,0,1,1,0,0,1,0,1,1,1,0,0,1,0],
[1,1,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1],
[1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,1,1,0,1,0,0,1,1,1,0,1,1,1],
[1,0,1,0,0,1,0,0,1,0,0,1,1,0,0,0,0,1,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,1,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,1]
];
const confirmKeyText = [
[0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0,1,0,1,1,1,1,0],
[1,0,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,1,0,1],
[1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1],
[0,1,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1]
];
const cancelKeyText = [
[0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,1,1,0,1,1,0,0,0,1,0,0,1,0,0,1],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1],
[1,0,0,0,1,1,1,0,1,0,1,0,1,0,0,1,1,1,0,1],
[0,1,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,0,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0]
];
const pauseKeyText = [
[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,0,1,1,0,1,0,1,0,1,1,0,0,1,0],
[1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1],
[1,1,0,0,1,1,1,0,1,0,1,0,0,1,0,1,1,1],
[1,0,0,0,1,0,1,0,0,1,1,0,1,1,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
];
const negativeAimXText = [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
[0,0,0,0,0,1,1,0,1,0,1,1,1,1,0,0,1,0,1],
[1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,0,0,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const positiveAimXText = [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
[0,1,0,0,0,1,1,0,1,0,1,1,1,1,0,0,1,0,1],
[1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,1,0,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const negativeAimYText = [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
[0,0,0,0,0,1,1,0,1,0,1,1,1,1,0,0,1,0,1],
[1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,0,0,0,1,1,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const positiveAimYText = [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
[0,1,0,0,0,1,1,0,1,0,1,1,1,1,0,0,1,0,1],
[1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[0,1,0,0,1,1,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const pausedText = [
[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,1,0,0,1,1,0,1,0,1,0,1,1,0,0,1,0,0,0,1,1],
[1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,1,0,1],
[1,1,0,0,1,1,1,0,1,0,1,0,0,1,0,1,1,1,0,1,0,1],
[1,0,0,0,1,0,1,0,0,1,1,0,1,1,0,1,0,0,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0]
];
const continueText = [
[1,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,0,1,0,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,0],
[1,0,1,0,1,0,1,0,0,1,0,0,1,0,1,0,1,1,0,0,1,0,1],
[1,1,0,0,1,1,1,0,0,1,0,0,1,0,1,0,1,0,0,0,1,0,1],
[1,0,1,0,1,0,0,0,0,1,1,0,0,1,1,0,1,0,0,0,1,0,1],
[1,0,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const mainMenuText = [
[1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
[1,1,0,1,1,0,0,1,1,0,1,0,1,1,0,0,1,1,0,1,1,0,0,1,0,0,1,1,0,0,1,0,1],
[1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0]
];
const exitGameText = [
[1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,0,0,1,0,1,0,1,0,1,1,1,0,0,0,1,0,0,0,0,0,1,1,0,1,1,1,1,0,0,0,1,0],
[1,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,1,0,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
[1,0,0,0,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1],
[1,1,1,0,1,0,1,0,1,0,0,1,1,0,0,0,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1]
];
const exitToMainMenuText = [
[1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
[1,0,0,0,1,0,1,0,1,0,1,1,1,0,0,0,1,1,1,0,0,1,0,0,0,0,1,1,0,1,1,0,0,1,1,0,1,0,1,1,0,0,1,1,0,1,1,0,0,1,0,0,1,1,0,0,1,0,1,0,1,0,1],
[1,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,0,0,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1],
[1,0,0,0,1,0,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,0,0,1,0],
[1,1,1,0,1,0,1,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0,0,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,1,1,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0]
];
const exitToStageSelectText = [
[1,1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,1,0,0,0,1,0],
[1,0,0,0,1,0,1,0,1,0,1,1,1,0,0,0,1,1,1,0,0,1,0,0,0,0,1,0,0,0,1,1,1,0,0,1,1,0,1,1,1,0,1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,1,1,0,1,0,1],
[1,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,1,1,0,0,1,0,0,1,1,1,0,1,0,1,1,1,0,1,0,0,0,1,0,0,0,0,1],
[1,0,0,0,1,0,1,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,1,0,0,1,0,0,1,1,1,0,1,1,1,0,1,0,0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
[1,1,1,0,1,0,1,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0,0,0,1,1,0,0,0,1,1,0,1,0,1,0,0,0,1,0,0,1,1,0,1,1,0,0,0,1,1,0,1,0,0,1,1,0,0,1,0,0,1,1,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0]
];
const yesText = [
[1,0,1,0,0,0,0,0,0,0,0],
[1,0,1,0,0,1,0,0,0,1,1],
[1,0,1,0,1,0,1,0,1,0,0],
[0,1,0,0,1,1,1,0,0,1,0],
[0,1,0,0,1,0,0,0,0,0,1],
[0,1,0,0,0,1,1,0,1,1,0]
];
const noText = [
[1,0,0,0,1,0,0,0,0,0],
[1,1,0,0,1,0,0,1,1,0],
[1,1,1,0,1,0,1,0,0,1],
[1,0,1,1,1,0,1,0,0,1],
[1,0,0,1,1,0,1,0,0,1],
[1,0,0,0,1,0,0,1,1,0]
];
const confirmPlayersText = [
[0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
[1,0,0,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0,1,0,1,1,1,1,0,0,0,0,1,0,1,0,1,0,0,1,1,0,1,0,1,0,1,0,1,0,0,1,0,1,1],
[1,0,0,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,0,1,0],
[1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,1,0,0,1,0,1,1,1,0,0,1,0,0,1,0,0,0,1,0,0,0,1],
[0,1,1,0,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1,0,1,0,0,0,0,1,1,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const resultsText = [
[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0],
[1,0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,1,1,1,0,1,1],
[1,1,0,0,1,1,1,0,1,0,0,1,0,1,0,1,0,0,1,0,0,1,0],
[1,0,1,0,1,0,0,0,0,1,0,1,0,1,0,1,0,0,1,0,0,0,1],
[1,0,1,0,0,1,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,1,1]
];
const WinnerTexts = [
[
	[0,1,0,0,0,0,0,1,0],
	[1,1,0,1,1,0,1,1,1],
	[0,1,0,1,0,0,0,1,0],
	[0,1,0,0,1,0,0,1,0],
	[0,1,0,1,1,0,0,1,1]
],
[
	[1,1,1,0,0,0,0,0,0,0,1],
	[0,0,1,0,1,1,0,0,0,1,1],
	[1,1,1,0,1,0,1,0,1,0,1],
	[1,0,0,0,1,0,1,0,1,0,1],
	[1,1,1,0,1,0,1,0,0,1,1]
],
[
	[1,1,1,0,0,0,0,0,0,1],
	[0,0,1,0,0,1,0,0,1,1],
	[1,1,1,0,1,0,0,1,0,1],
	[0,0,1,0,1,0,0,1,0,1],
	[1,1,1,0,1,0,0,0,1,1]
],
[
	[1,0,1,0,0,1,0,0,1,0,0],
	[1,0,1,0,1,1,1,0,1,1,0],
	[1,1,1,0,0,1,0,0,1,0,1],
	[0,0,1,0,0,1,0,0,1,0,1],
	[0,0,1,0,0,1,1,0,1,0,1]
]
];
const rematchText = [
[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
[1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0],
[1,0,1,0,1,0,1,0,1,1,1,1,0,0,0,1,1,0,1,1,1,0,0,1,0,1,1,0],
[1,1,0,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,0,1,0,0,1,0,1],
[1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,0,1,0,0,1,0,0,1,0,1],
[1,0,1,0,0,1,1,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0,0,1,0,1,0,1]
];
const stageSelectSmallText = [
[0,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,1,0],
[1,0,0,0,1,1,1,0,0,1,1,0,1,1,1,0,1,0,1,0,1,0,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,1,1],
[0,1,0,0,0,1,0,0,1,0,1,0,1,0,1,0,1,1,1,0,0,1,0,0,1,1,1,0,1,0,1,1,1,0,1,0,0,0,1,0],
[0,0,1,0,0,1,0,0,1,1,1,0,1,1,1,0,1,0,0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0],
[1,1,0,0,0,1,1,0,1,0,1,0,0,0,1,0,0,1,1,0,1,1,0,0,0,1,1,0,1,0,0,1,1,0,0,1,0,0,1,1],
[0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const GUIstate = {
	Enabled:0,
	Disabled:1,
	Hidden:2
};

const GUI = {
logo:{data:logo, xDiff:-430, yDiff:-288, textWidth:10, textHeight:9, textXoffset:1, textYoffset:1, textXgap:1, textYgap:1, textColor:"#FFFFFF", bgColor:"#00000000", drawStarted:false, secret:false},
main:{
	run(){MainMenu();},
	button:[
		{data:adventureText, menu:"adventure", xDiff:-205, yDiff:-20, width:410, height:75, textXoffset:8, textYoffset:8},
		{data:battleText, menu:"battle", xDiff:-150, yDiff:60, width:300, height:75, textXoffset:35, textYoffset:8},
		{data:optionsText, menu:"options", xDiff:-150, yDiff:140, width:300, height:75, textXoffset:13, textYoffset:8}
	]
},
adventure:{
	run(){Adventure();},
	title:{data:adventureText,cancel:true,xDiff:-205,yDiff:-20,width:410,height:75,textXoffset:8,textYoffset:8,targetXdiff:-450,targetYdiff:-155,targetWidth:900,targetHeight:225},
	button:[
		{data:startText, xDiff:-117, yDiff:-38, width:234, height:75, textXoffset:13, textYoffset:13}
	]
},
battle:{
	run(){Battle();},
	title:{data:battleText,cancel:true,xDiff:-150,yDiff:60,width:300,height:75,textXoffset:35,textYoffset:8,targetXdiff:-450,targetYdiff:-155,targetWidth:900,targetHeight:450},
	background:[
		{data:null, xDiff:-140, yDiff:-87, width:580, height:372, bgColor:"#00000000"}, //stageSelectBg
		{data:null, xDiff:-448, yDiff:-80, width:298, height:96, bgColor:"#333333"}, //gameTypeBg
		{data:null, xDiff:-448, yDiff:16, width:298, height:277, bgColor:"#444444"} //gameConfigBg
	],
	label:[
		{data:stageSelectText, xDiff:2, yDiff:-130, textWidth:6, textHeight:5},
		{data:gameTypeText, xDiff:-427, yDiff:-63, textWidth:3, textHeight:2},
		{data:winScoreText, xDiff:-427, yDiff:-16, textWidth:3, textHeight:2},
		{data:lifeCountText, xDiff:-427, yDiff:-16, textWidth:3, textHeight:2},
		{data:shotSpeedText, xDiff:-427, yDiff:32, textWidth:3, textHeight:2},
		{data:infiniteJumpText, xDiff:-427, yDiff:77, textWidth:3, textHeight:2},
		{data:knockBackText, xDiff:-427, yDiff:124, textWidth:3, textHeight:2},
		{data:instantChargeText, xDiff:-427, yDiff:167, textWidth:3, textHeight:2},
		{data:fixedCameraText, xDiff:-427, yDiff:212, textWidth:3, textHeight:2},
		{data:noPile1Text, xDiff:-427, yDiff:247, textWidth:3, textHeight:2},
		{data:noPile2Text, xDiff:-427, yDiff:267, textWidth:3, textHeight:2}
	],
	dropdown:[
		{data:null,activeItem:0,selectedItem:0,xDiff:-275,yDiff:-70,width:115,height:32,pTextAlign:"left",pFontSize:20,pTextXoffset:8,pTextYoffset:-9,
			item:[
				{data:null,pText:"Score-battle"}, //add gameType property?
				{data:null,pText:"Life-battle"}
			]
		}
	],
	adjustbox:[
		{data:Adjust, prop:[Game,"winScore"], min:1, max:100, xDiff:-251, yDiff:-25, width:91, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4,
			number:[
				{data:Numbers[5], xDiff:51, textYoffset:4, textWidth:5, textHeight:4},
				{data:Numbers[0], xDiff:31, textYoffset:4, textWidth:5, textHeight:4},
				{data:Numbers[0], xDiff:11, textYoffset:4, textWidth:5, textHeight:4}
			]
		},
		{data:Adjust, prop:[Game,"lifeCount"], min:1, max:100, xDiff:-251, yDiff:-25, width:91, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4,
			number:[
				{data:Numbers[3], xDiff:51, textYoffset:4, textWidth:5, textHeight:4},
				{data:Numbers[0], xDiff:31, textYoffset:4, textWidth:5, textHeight:4},
				{data:Numbers[0], xDiff:11, textYoffset:4, textWidth:5, textHeight:4}
			]
		},
		{data:Adjust, prop:[Game,"shotSpeed"], min:1, max:5, xDiff:-251, yDiff:25, width:91, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4,
			number:[
				{data:Numbers[5], xDiff:37, textYoffset:4, textWidth:5, textHeight:4}
			]
		}
	],
	checkbox:[
		{data:Disable, prop:[Game,"infiniteJump"], xDiff:-197, yDiff:70, width:37, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4},
		{data:Disable, prop:[Game,"noKnockback"], xDiff:-197, yDiff:115, width:37, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4},
		{data:Disable, prop:[Game,"instantCharge"], xDiff:-197, yDiff:160, width:37, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4},
		{data:Disable, prop:[Game,"fixedCamera"], xDiff:-197, yDiff:205, width:37, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4},
		{data:Disable, prop:[Game,"noPile"], xDiff:-197, yDiff:250, width:37, height:32, textXoffset:4, textYoffset:4, textWidth:5, textHeight:4}
	],
	button:[
		{data:Minus, xDiff:-140, yDiff:-147, width:60, height:52, textXoffset:3, textYoffset:2},
		{data:Plus, xDiff:378, yDiff:-147, width:60, height:52, textXoffset:3, textYoffset:2}
	],
	stagebutton:[
	]
},
options:{
	run(){Options();},
	title:{data:optionsText,cancel:true,xDiff:-150,yDiff:140,width:300,height:75,textXoffset:13,textYoffset:8,targetXdiff:-450,targetYdiff:-155,targetWidth:900,targetHeight:450},
	background:[
		{data:null, xDiff:-430, yDiff:129, width:150, height:150, bgColor:"#777777", bgFadeColor:"#333333",
			background:[{data:null, width:4, height:4, bgColor:"#FF0000", bgFadeColor:"#770000"}] //StickAim test area dot
		} //StickAim test area
	],
	label:[
		{data:soundVolumeText, xDiff:-382, yDiff:-63, textWidth:5, textHeight:4},
		{data:resolutionText, xDiff:-316, yDiff:-14, textWidth:5, textHeight:4},
		{data:collisionQualityText, xDiff:-430, yDiff:35, textWidth:5, textHeight:4},
		{data:guiScaleText, xDiff:-251, yDiff:88, textWidth:4, textHeight:3},
		{data:vsyncText, xDiff:-430, yDiff:88, textWidth:4, textHeight:3},
		{data:upKeyText, xDiff:152, yDiff:-130, textWidth:4, textHeight:3},
		{data:downKeyText, xDiff:102, yDiff:-86, textWidth:4, textHeight:3},
		{data:leftKeyText, xDiff:122, yDiff:-46, textWidth:4, textHeight:3},
		{data:rightKeyText, xDiff:112, yDiff:-4, textWidth:4, textHeight:3},
		{data:jumpKeyText, xDiff:107, yDiff:38, textWidth:4, textHeight:3},
		{data:chargeKeyText, xDiff:-28, yDiff:80, textWidth:4, textHeight:3},
		{data:chargeHoldKeyText, xDiff:2, yDiff:122, textWidth:4, textHeight:3},
		{data:confirmKeyText, xDiff:72, yDiff:164, textWidth:4, textHeight:3},
		{data:cancelKeyText, xDiff:92, yDiff:206, textWidth:4, textHeight:3},
		{data:pauseKeyText, xDiff:102, yDiff:248, textWidth:4, textHeight:3},
		{data:negativeAimXText, xDiff:-270, yDiff:137, textWidth:4, textHeight:3},
		{data:positiveAimXText, xDiff:-270, yDiff:175, textWidth:4, textHeight:3},
		{data:negativeAimYText, xDiff:-270, yDiff:213, textWidth:4, textHeight:3},
		{data:positiveAimYText, xDiff:-270, yDiff:251, textWidth:4, textHeight:3}
	],
	adjustbox:[
		{data:Adjust, prop:[Game,"soundVolume"], mod:0.01, min:0, max:1, xDiff:-103, yDiff:-69, width:119, height:42, textXoffset:4, textYoffset:4, textWidth:7, textHeight:6,
			number:[
				{data:Numbers[0], xDiff:67, textYoffset:4, textWidth:7, textHeight:6},
				{data:Numbers[0], xDiff:40, textYoffset:4, textWidth:7, textHeight:6},
				{data:Numbers[1], xDiff:13, textYoffset:4, textWidth:7, textHeight:6}
			]
		},
		{data:Adjust, get value(){return Screen.pixelScale;}, set value(v){Screen.pixelScale=v;ScreenSize();}, min:1, xDiff:-103, yDiff:-20, width:119, height:42, textXoffset:4, textYoffset:4, textWidth:7, textHeight:6,
			number:[
				{data:Numbers[0], xDiff:67, textYoffset:4, textWidth:7, textHeight:6},
				{data:Numbers[0], xDiff:40, textYoffset:4, textWidth:7, textHeight:6},
				{data:Numbers[1], xDiff:13, textYoffset:4, textWidth:7, textHeight:6}
			]
		}, //resolution
		{data:Adjust, get value(){return Game.updateInterval;}, set value(v){Game.updateInterval=v;UpdateMultiplier(Game.updateInterval);}, mod:-1, min:1, max:5, xDiff:-103, yDiff:29, width:119, height:42, textXoffset:4, textYoffset:4, textWidth:7, textHeight:6,
			number:[
				{data:Numbers[0], xDiff:67, textYoffset:4, textWidth:7, textHeight:6},
				{data:Numbers[0], xDiff:40, textYoffset:4, textWidth:7, textHeight:6},
				{data:Numbers[1], xDiff:13, textYoffset:4, textWidth:7, textHeight:6}
			]
		} //collisionQuality
	],
	checkbox:[
		{data:Enable, get value(){return Screen.guiScaleOn;}, set value(v){Screen.guiScaleOn=v;ScreenSize();}, xDiff:-103, yDiff:81, width:42, height:37, textXoffset:4, textYoffset:4, textWidth:6, textHeight:5},
		{data:Enable, get value(){return Screen.vsync;}, set value(v){Screen.vsync=v;ScreenSize();}, xDiff:-317, yDiff:81, width:42, height:37, textXoffset:4, textYoffset:4, textWidth:6, textHeight:5}
	],
	inputfield:[ //keyBind inputfield
		{data:null, inputType:Input.up, xDiff:200, yDiff:-139, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.down, xDiff:200, yDiff:-97, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.left, xDiff:200, yDiff:-55, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.right, xDiff:200, yDiff:-13, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.jump, xDiff:200, yDiff:29, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.charge, xDiff:200, yDiff:71, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.chargehold, xDiff:200, yDiff:113, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.confirm, xDiff:200, yDiff:155, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.cancel, xDiff:200, yDiff:197, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.pause, xDiff:200, yDiff:239, width:199, height:40, pTextAlign:"right", pFontSize:30, pTextXoffset:-6, pTextYoffset:-10,
			button:[{data:Plus, xDiff:201, width:39, height:40, textYoffset:3, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.aimXneg, xDiff:-167, yDiff:129, width:116, height:36, pTextAlign:"right", pFontSize:24, pTextXoffset:-6, pTextYoffset:-12,
			button:[{data:Plus, xDiff:118, width:39, height:36, textYoffset:1, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.aimXpos, xDiff:-167, yDiff:167, width:116, height:36, pTextAlign:"right", pFontSize:24, pTextXoffset:-6, pTextYoffset:-12,
			button:[{data:Plus, xDiff:118, width:39, height:36, textYoffset:1, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.aimYneg, xDiff:-167, yDiff:205, width:116, height:36, pTextAlign:"right", pFontSize:24, pTextXoffset:-6, pTextYoffset:-12,
			button:[{data:Plus, xDiff:118, width:39, height:36, textYoffset:1, textWidth:7, textHeight:6}]},
		{data:null, inputType:Input.aimYpos, xDiff:-167, yDiff:243, width:116, height:36, pTextAlign:"right", pFontSize:24, pTextXoffset:-6, pTextYoffset:-12,
			button:[{data:Plus, xDiff:118, width:39, height:36, textYoffset:1, textWidth:7, textHeight:6}]}
	],
	button:[
		{data:Numbers[1],player:1,xDiff:-150,yDiff:-155,width:52,height:41,textXoffset:9,textYoffset:6,textWidth:6,textHeight:5,borderColor:PlayerColor[1].color}, //playerButton1
		{data:Numbers[2],player:2,xDiff:-98,yDiff:-155,width:52,height:41,textXoffset:16,textYoffset:6,textWidth:6,textHeight:5,borderColor:PlayerColor[2].color}, //playerButton2
		{data:Numbers[3],player:3,xDiff:-46,yDiff:-155,width:52,height:41,textXoffset:16,textYoffset:6,textWidth:6,textHeight:5,borderColor:PlayerColor[3].color}, //playerButton3
		{data:Numbers[4],player:4,xDiff:6,yDiff:-155,width:52,height:41,textXoffset:16,textYoffset:6,textWidth:6,textHeight:5,borderColor:PlayerColor[4].color} //playerButton4
	],
	dropdown:[
		{data:null,activeItem:0,selectedItem:0,xDiff:-150,yDiff:-117,width:208,height:37,pTextAlign:"left",pFontSize:20,pTextXoffset:10,pTextYoffset:-12,
			item:[
			]
		}
	]
},
pause:{
	run(){Pause();},
	label:[
		{data:pausedText, xDiff:-241, yDiff:-80, textWidth:20, textHeight:18, textXgap:2, textYgap:2, textColor:"#0000FF"}
	],
	button:[
		{data:continueText, xDiff:-150, yDiff:60, width:300, height:75, textXoffset:24, textYoffset:8},
		{data:optionsText, menu:"options", xDiff:-150, yDiff:140, width:300, height:75, textXoffset:13, textYoffset:8},
		{data:exitGameText, menu:"exitGame", xDiff:-150, yDiff:230, width:300, height:60, textXoffset:15, textYoffset:10, textWidth:7, textHeight:6}
	]
},
exitGame:{
	run(){ExitGame();},
	title:{data:exitGameText,cancel:true,xDiff:-150,yDiff:230,width:300,height:60,textXoffset:15,textYoffset:10,textWidth:7,textHeight:6,targetXdiff:-350,targetYdiff:-55,targetWidth:700,targetHeight:250},
	label:[
		{data:exitToMainMenuText, xDiff:-220, yDiff:25, textWidth:6, textHeight:5},
		{data:exitToStageSelectText, xDiff:-244, yDiff:25, textWidth:6, textHeight:5}
	],
	button:[
		{data:noText, cancel:true, xDiff:100, yDiff:90, width:200, height:75, textXoffset:46, textYoffset:8},
		{data:yesText, xDiff:-300, yDiff:90, width:200, height:75, textXoffset:40, textYoffset:8}
	]
},
results:{
	run(){Results();},
	title:{data:resultsText,xDiff:-450,yDiff:-155,width:278,height:75,textXoffset:13,textYoffset:8,targetWidth:900,targetHeight:400, isOption:false},
	background:[
		{data:Numbers[1],xDiff:-380,yDiff:-65,width:160,height:230,border:3,textXoffset:63,textWidth:6,textHeight:5,textColor:Color.playerText,borderColor:PlayerColor[1].fade,bgColor:PlayerColor[1].color,
			label:[{data:null,textYoffset:10,textBorder:2,textColor:Color.optionTextHgl}]
		},
		{data:Numbers[2],xDiff:-180,yDiff:-65,width:160,height:230,border:3,textXoffset:70,textWidth:6,textHeight:5,textColor:Color.playerText,borderColor:PlayerColor[2].fade,bgColor:PlayerColor[2].color,
			label:[{data:null,textYoffset:10,textBorder:2,textColor:Color.optionTextHgl}]
		},
		{data:Numbers[3],xDiff:20,yDiff:-65,width:160,height:230,border:3,textXoffset:70,textWidth:6,textHeight:5,textColor:Color.playerText,borderColor:PlayerColor[3].fade,bgColor:PlayerColor[3].color,
			label:[{data:null,textYoffset:10,textBorder:2,textColor:Color.optionTextHgl}]
		},
		{data:Numbers[4],xDiff:220,yDiff:-65,width:160,height:230,border:3,textXoffset:70,textWidth:6,textHeight:5,textColor:Color.playerText,borderColor:PlayerColor[4].fade,bgColor:PlayerColor[4].color,
			label:[{data:null,textYoffset:10,textBorder:2,textColor:Color.optionTextHgl}]
		}
	],
	button:[
		{data:rematchText, xDiff:-416, yDiff:180, width:211, height:51, textXoffset:8,textYoffset:8,textWidth:6,textHeight:5},
		{data:stageSelectSmallText, menu:"battle", xDiff:-165, yDiff:180, width:295, height:51, textXoffset:8,textYoffset:8,textWidth:6,textHeight:5},
		{data:mainMenuText, menu:"main", xDiff:170, yDiff:180, width:246, height:51, textXoffset:8,textYoffset:8,textWidth:6,textHeight:5}
	]
},
playerConfirm:{
	label:[
		{data:confirmPlayersText, xDiff:0, yDiff:-130, textWidth:6, textHeight:5},
		{data:null, xDiff:0, yDiff:-12, pTextWidth:860, pTextAlign:"center", pFontSize:"bold 30", pTextColor:Color.menuText},
		{data:null, xDiff:0, yDiff:20, pTextAlign:"center", pFontSize:"bold 20", pTextColor:Color.menuText, pText:"(or doubleclick)"}
	],
	background:[
		{data:Numbers[1],xDiff:-380,yDiff:40,width:160,height:80,textXoffset:63,textYoffset:5,textWidth:6,textHeight:5,textColor:Color.playerText,textFadeColor:Color.playerText,textHglColor:Color.optionTextHgl,bgColor:PlayerColor[1].color,bgFadeColor:PlayerColor[1].fade,bgHglColor:PlayerColor[1].color,
			background:[{data:null,xDiff:3,yDiff:40,width:154,height:37,pTextAlign:"center",pFontSize:"bold 20",pTextYoffset:-12,pTextColor:Color.playerText,bgColor:PlayerColor[1].bg,bgFadeColor:PlayerColor[1].bgFade,bgHglColor:Color.optionTextHgl}]
		},
		{data:Numbers[2],xDiff:-180,yDiff:40,width:160,height:80,textXoffset:70,textYoffset:5,textWidth:6,textHeight:5,textColor:Color.playerText,textFadeColor:Color.playerText,textHglColor:Color.optionTextHgl,bgColor:PlayerColor[2].color,bgFadeColor:PlayerColor[2].fade,bgHglColor:PlayerColor[2].color,
			background:[{data:null,xDiff:3,yDiff:40,width:154,height:37,pTextAlign:"center",pFontSize:"bold 20",pTextYoffset:-12,pTextColor:Color.playerText,bgColor:PlayerColor[2].bg,bgFadeColor:PlayerColor[2].bgFade,bgHglColor:Color.optionTextHgl}]
		},
		{data:Numbers[3],xDiff:20,yDiff:40,width:160,height:80,textXoffset:70,textYoffset:5,textWidth:6,textHeight:5,textColor:Color.playerText,textFadeColor:Color.playerText,textHglColor:Color.optionTextHgl,bgColor:PlayerColor[3].color,bgFadeColor:PlayerColor[3].fade,bgHglColor:PlayerColor[3].color,
			background:[{data:null,xDiff:3,yDiff:40,width:154,height:37,pTextAlign:"center",pFontSize:"bold 20",pTextYoffset:-12,pTextColor:Color.playerText,bgColor:PlayerColor[3].bg,bgFadeColor:PlayerColor[3].bgFade,bgHglColor:Color.optionTextHgl}]
		},
		{data:Numbers[4],xDiff:220,yDiff:40,width:160,height:80,textXoffset:70,textYoffset:5,textWidth:6,textHeight:5,textColor:Color.playerText,textFadeColor:Color.playerText,textHglColor:Color.optionTextHgl,bgColor:PlayerColor[4].color,bgFadeColor:PlayerColor[4].fade,bgHglColor:PlayerColor[4].color,
			background:[{data:null,xDiff:3,yDiff:40,width:154,height:37,pTextAlign:"center",pFontSize:"bold 20",pTextYoffset:-12,pTextColor:Color.playerText,bgColor:PlayerColor[4].bg,bgFadeColor:PlayerColor[4].bgFade,bgHglColor:Color.optionTextHgl}]
		}
	]
}
};
AddDefaultProperties(GUI.logo,"logo",GUI);
for(let menu in GUI){ //assigning default values to properties manually instead of using an object prototype with default values (Should I?)
	if(GUI.hasOwnProperty(menu))
		CheckElementProperties(GUI[menu],menu,GUI,GUI[menu]);
}
function CheckElementProperties(element,elementType,parent,menu){
	for(let obj in element){
		if(element.hasOwnProperty(obj)){
			if(obj === "parent")
				break;
			if(element[obj] !== null){
				if(element[obj].hasOwnProperty("data")){
					let type = (isNaN(obj)) ? obj : elementType; //isNaN(obj) means that element is not inside an array so "obj" is the elementType (title for example)
					AddDefaultProperties(element[obj],type,parent,menu);
				}
				if(!isNaN(obj) && !isNaN(elementType))
					break;
				
				CheckElementProperties(element[obj],obj,element,menu);
			}
		}
	}
}
function AddDefaultProperties(element, elementType, parent, menu=null){ //element.property ??= default
	element.parent = parent;
	element.type = elementType;
	
	if(element.type==="title" ||
	element.type==="button" ||
	element.type==="checkbox" ||
	element.type==="adjustbox" ||
	element.type==="inputfield" ||
	element.type==="dropdown" ||
	element.type==="stagebutton"){ //dropdown item?
		if(!element.hasOwnProperty("isOption") || element.isOption){
			element.isOption = true;
			if(!menu.hasOwnProperty("options"))
				menu.options = [];
			menu.options.push(element);
		}
		if(element.type==="checkbox" || element.type==="adjustbox"){
			if(!element.hasOwnProperty("value")){
				Object.defineProperty(element,"value",{
					get: function(){return element.prop[0][element.prop[1]];},
					set: function(v){element.prop[0][element.prop[1]] = v;}
				});
			}
			if(element.type==="adjustbox"){
				if(!element.hasOwnProperty("mod")) element.mod = 1;
				if(!element.hasOwnProperty("min")) element.min = 0;
				if(!element.hasOwnProperty("max")) element.max = 100;
			}
		}
	} else
		element.isOption = false;
	
	if(!element.hasOwnProperty("xDiff")) element.xDiff = 0;
	if(!element.hasOwnProperty("yDiff")) element.yDiff = 0;
	element.orgXdiff = element.xDiff;
	element.orgYdiff = element.yDiff;
	if(!element.hasOwnProperty("width")) element.width = 0;
	if(!element.hasOwnProperty("height")) element.height = 0;
	element.orgWidth = element.width;
	element.orgHeight = element.height;
	if(!element.hasOwnProperty("padding")) element.padding = 0;
	if(!element.hasOwnProperty("border")){
		if(element.type === "background")
			element.border = 0;
		else
			element.border = 2;
	}
	if(!element.hasOwnProperty("textBorder")) element.textBorder = 0;
	if(!element.hasOwnProperty("textBorderColor")) element.textBorderColor = "#000000";
	if(!element.hasOwnProperty("textXoffset")) element.textXoffset = 0;
	if(!element.hasOwnProperty("textYoffset")) element.textYoffset = 0;
	if(!element.hasOwnProperty("textWidth")) element.textWidth = 10;
	if(!element.hasOwnProperty("textHeight")) element.textHeight = 9;
	if(!element.hasOwnProperty("textXgap")) element.textXgap = 1;
	if(!element.hasOwnProperty("textYgap")) element.textYgap = 1;
	if(!element.hasOwnProperty("targetXdiff")) element.targetXdiff = element.xDiff;
	if(!element.hasOwnProperty("targetYdiff")) element.targetYdiff = element.yDiff;
	if(!element.hasOwnProperty("targetWidth")) element.targetWidth = element.width;
	if(!element.hasOwnProperty("targetHeight")) element.targetHeight = element.height;
	element.orgTargetHeight = element.targetHeight; //used for playerConfirm
	element.orgTargetWidth = element.targetWidth; //not used for anything yet...
	if(!element.hasOwnProperty("borderColor")){
		if(element.type === "title")
			element.borderColor = Color.menuBorder;
		else if(element.type === "item")
			element.borderColor = Color.optionBg;
		else
			element.borderColor = Color.optionBorder;
	}
	if(!element.hasOwnProperty("borderHglColor")) element.borderHglColor = Color.optionBorderHgl; //shorter names?
	if(!element.hasOwnProperty("borderFadeColor")) element.borderFadeColor = Color.optionFade;
	if(!element.hasOwnProperty("bgColor")){
		if(element.type === "title")
			element.bgColor = Color.menuBg;
		else
			element.bgColor = Color.optionBg;
	}
	if(!element.hasOwnProperty("bgHglColor")) element.bgHglColor = Color.optionBgHgl;
	if(!element.hasOwnProperty("bgFadeColor")) element.bgFadeColor = Color.optionBg;
	if(!element.hasOwnProperty("fgColor")) element.fgColor = Color.menuBorder;
	if(!element.hasOwnProperty("textColor")){
		if(element.type === "title")
			element.textColor = Color.menuTitle;
		else if(element.isOption)
			element.textColor = Color.optionText;
		else
			element.textColor = Color.menuText;
	}
	if(!element.hasOwnProperty("textHglColor")) element.textHglColor = Color.optionTextHgl;
	if(!element.hasOwnProperty("textFadeColor")){
		if(element.isOption)
			element.textFadeColor = Color.optionFade;
		else
			element.textFadeColor = Color.menuTextFade;
	}
	if(!element.hasOwnProperty("guiState")) element.guiState = GUIstate.Enabled;
	if(!element.hasOwnProperty("selected")) element.selected = false;
	if(!element.hasOwnProperty("pTextAlign")) element.pTextAlign = "center";
	if(!element.hasOwnProperty("pFontSize")) element.pFontSize = 30;
	element.orgPfontSize = element.pFontSize;
	if(!element.hasOwnProperty("pTextXoffset")) element.pTextXoffset = 0;
	if(!element.hasOwnProperty("pTextYoffset")) element.pTextYoffset = 0;
	if(!element.hasOwnProperty("pTextWidth")) element.pTextWidth = element.width;
	if(!element.hasOwnProperty("pTextColor")) element.pTextColor = Color.plainText;
	if(!element.hasOwnProperty("pText")) element.pText = "";
}

function AddStageButton(stageIndex,stageWidth,stageHeight){
	GUI.battle.stagebutton.push({data:null, stage:stageIndex});
	AddDefaultProperties(GUI.battle.stagebutton[GUI.battle.stagebutton.length-1],"stagebutton",GUI.battle.background[0],GUI.battle);
}
function UpdateInputMethodMenu(){
	let inputDropdown = GUI.options.dropdown[0];
	inputDropdown.item = [];
	inputDropdown.borderColor = PlayerColor[KeyBind.player].color;
	inputDropdown.targetWidth = inputDropdown.orgWidth;
	
	guiRender.font = inputDropdown.pFontSize+"px Arial";
	for(let method = 0; method < InputMethods.length; method++){
		inputDropdown.targetWidth = Math.max(inputDropdown.targetWidth, Math.floor(guiRender.measureText(InputMethods[method].id).width));
		inputDropdown.item.push({data:null,pText:InputMethods[method].id});
		AddDefaultProperties(inputDropdown.item[method],"item",inputDropdown,GUI.options);
		inputDropdown.item[method].bgHglColor = PlayerColor[KeyBind.player].fade;
	}
	inputDropdown.item.push({data:null,pText:"No input"});
	AddDefaultProperties(inputDropdown.item[inputDropdown.item.length-1],"item",inputDropdown,GUI.options);
	inputDropdown.item[inputDropdown.item.length-1].bgHglColor = PlayerColor[KeyBind.player].fade;
	
	if(Players[KeyBind.player].inputMethod===-1) //KeyBind.player has no inputMethod
		inputDropdown.activeItem = inputDropdown.item.length-1;
	else
		inputDropdown.activeItem = Players[KeyBind.player].inputMethod;
	
	inputDropdown.selectedItem = inputDropdown.activeItem;
}
function CloseAllMenus(){
	Menu.active = null;
	Menu.subMenu = null;
}
function CurrentMenu(){
	return (Menu.subMenu!==null) ? Menu.subMenu : Menu.active; //return Menu.subMenu ?? Menu.active;
}
function GetClosestOption(direction,option){
	let menuGUI = CurrentMenu();
	let guiElement = option;
	let guiParent = guiElement.parent;
	
	let siblingFound = false;
	let minDistance = Infinity;
	let maxOverlap = 0; //decreasing this initial value makes menu navigation less strict
	let overlapThreshold = 0.5; //percentage of length overlap required if a closer gui-element is found
	
	let guiTop = guiElement.yDiff+(guiParent.yDiff || 0); //?? 0
	let guiHeight = (guiElement.type==="title") ? guiElement.orgHeight : guiElement.height;
	let guiBottom = guiTop+guiHeight;
	let guiLeft = guiElement.xDiff+(guiParent.xDiff || 0); //?? 0
	let guiWidth = (guiElement.type==="title") ? guiElement.orgWidth : guiElement.width;
	let guiRight = guiLeft+guiWidth;
	
	for(let newElement of menuGUI.options){
		if(guiElement===newElement || newElement.guiState !== GUIstate.Enabled)
			continue;
		
		let newParent = newElement.parent;
		
		let newTop = newElement.yDiff+(newParent.yDiff || 0); //?? 0
		let newHeight = (newElement.type==="title") ? newElement.orgHeight : newElement.height;
		let newBottom = newTop+newHeight;
		let newLeft = newElement.xDiff+(newParent.xDiff || 0); //?? 0
		let newWidth = (newElement.type==="title") ? newElement.orgWidth : newElement.width;
		let newRight = newLeft+newWidth;
		
		let overlap = 0;
		if(direction===Input.up || direction===Input.down){
			overlap = Math.min(guiRight,newRight)-Math.max(guiLeft,newLeft);
			overlap /= Math.min(guiWidth,newWidth);
		} else if(direction===Input.left || direction===Input.right){
			overlap = Math.min(guiBottom,newBottom)-Math.max(guiTop,newTop);
			overlap /= Math.min(guiHeight,newHeight);
		}
		
		let distance = 0;
		if(direction===Input.up)
			distance = guiTop-newBottom;
		else if(direction===Input.down)
			distance = newTop-guiBottom;
		else if(direction===Input.left)
			distance = guiLeft-newRight;
		else if(direction===Input.right)
			distance = newLeft-guiRight;
		
		if(distance < -5)
			continue;
		
		if(guiParent!==menuGUI && guiParent===newParent && !siblingFound){
			if(overlap >= overlapThreshold){
				siblingFound = true; //sibling objects have higher priority
				minDistance = Infinity; //override existing minDistance
			}
		}
		
		if(guiParent===newParent || !siblingFound)
		if((distance<minDistance && overlap >= overlapThreshold) || (overlap > maxOverlap && maxOverlap < overlapThreshold)){
			option = newElement;
			if(overlap >= overlapThreshold)
				minDistance = Math.min(distance,minDistance);
			
			maxOverlap = Math.max(overlap,maxOverlap);
		}
	}
	return option;
}
function PushGuiNavInput(inputType){
	if(KeyBind.inProgress || Mouse.drag || Option.select || Menu.animating || Loading.inProgress)
		return;
	
	if(!guiNavInputs.includes(inputType)) //only one input of each inputType per frame
		guiNavInputs.push(inputType);
}
function NavigateGUI(){
	let optionChanged = false;
	for(let input of guiNavInputs){
		if(input===Input.confirm){
			Option.select = true;
			break;
		} else if(input===Input.cancel){
			Option.select = true;
			Option.selected = Option.cancel;
			break;
		}
		if(Option.active===null){
			let previousOption = Option.selected;
			
			if(Menu.subMenu===GUI.options && input===Input.up && previousOption===GUI.options.dropdown[0])
				Option.selected = GUI.options.button[KeyBind.player-1]; //put selection to active playerButton
			else
				Option.selected = GetClosestOption(input,Option.selected);
			
			let stageSelect = (Menu.subMenu===GUI.battle && Stages.length>0 && Option.selected.parent === GUI.battle.background[0]);
			
			if(previousOption !== Option.selected)
				optionChanged = true;
			else if(stageSelect && input===Input.down){ //stage selection didn't change (this can be removed completely if maxOverlap value is decreased)
				if(stageRow === GetLastStageRow()-1){ //second last row
					Option.selected = GUI.battle.stagebutton[Stages.length-1]; //select last stage
					optionChanged = true;
				}
			}
			if(optionChanged && stageSelect){
				let selectedStage = Option.selected.stage+1; //index+1
				while(true){
					if(stageRow*stageColumnCount < selectedStage-stageColumnCount*stageColumnCount)
						stageRow++;
					else if(stageRow*stageColumnCount >= selectedStage)
						stageRow--;
					else
						break;
				}
			}
		} else {
			if(Option.active.hasOwnProperty("item")){ //dropdown
				let prevSelectedItem = Option.active.selectedItem;
				
				let firstIsActive = (Option.active.activeItem===0);
				let lastIsActive = (Option.active.activeItem===Option.active.item.length-1);
				//active item is at the top of the list: (this could be cleaned up (or dropdown items could be changed to regular gui-elements))
				if(input===Input.up){
					if(Option.active.selectedItem-1 === Option.active.activeItem)
						Option.active.selectedItem -= 1+!firstIsActive;
					else if(Option.active.selectedItem-1 < 0)
						Option.active.selectedItem = Option.active.activeItem;
					else if(Option.active.selectedItem !== Option.active.activeItem)
						Option.active.selectedItem--;
				} else if(input===Input.down){
					if(Option.active.selectedItem+1 === Option.active.activeItem)
						Option.active.selectedItem += 2*!lastIsActive;
					else if(Option.active.selectedItem === Option.active.activeItem)
						Option.active.selectedItem = 1*(firstIsActive && !lastIsActive);
					else if(Option.active.selectedItem < Option.active.item.length-1)
						Option.active.selectedItem++;
				}
				
				if(prevSelectedItem!==Option.active.selectedItem)
					optionChanged = true;
			} else if(input===Input.left || input===Input.right)
				SetAdjustBox(CurrentMenu(),Option.active,(input===Input.left) ? -1 : 1);
		}
	}
	if(optionChanged)
		PlaySound(Sounds.select);
	if(Option.select)
		PlaySound((Option.selected===Option.cancel || Option.selected.cancel) ? Sounds.cancel : Sounds.confirm);
	guiNavInputs = [];
}
function MouseOver(element){
	if(element.guiState !== GUIstate.Enabled)
		return false;
	
	guiY = Screen.scaledHeightHalf+element.yDiff+(element.parent.yDiff || 0); //?? 0
	guiX = Screen.scaledWidthHalf+element.xDiff+(element.parent.xDiff || 0); //?? 0
	if(Mouse.y>=guiY && Mouse.y<guiY+element.height && Mouse.x>=guiX && Mouse.x<guiX+element.width)
		return true;
	
	return false;
}
function CheckMouse(clicked){
	if(Menu.animating)
		return false;
	
	let menuGUI = CurrentMenu();
	
	for(let guiElement of menuGUI.options){
		if(guiElement.type === "title" && !Mouse.drag && Option.active===null){
			guiY = Screen.scaledHeightHalf+guiElement.yDiff;
			guiX = Screen.scaledWidthHalf+guiElement.xDiff;
			if(Mouse.y>=guiY && Mouse.y<guiY+guiElement.orgHeight)
			if(Mouse.x>=guiX && Mouse.x<guiX+guiElement.orgWidth){
				Option.selected = guiElement;
				return true;
			}
		}
		
		if(playerConfirm)
			continue;
		
		if(guiElement.type === "dropdown" && !Mouse.drag){
			if(Option.active===guiElement){
				for(let item = 0; item < guiElement.item.length; item++){
					if(MouseOver(guiElement.item[item])){
						guiElement.selectedItem = item;
						return true;
					}
				}
				if(clicked){
					Option.selected = Option.cancel;
					return true;
				}
			} else if(Option.active===null){
				if(MouseOver(guiElement)){
					Option.selected = guiElement;
					return true;
				}
			}
		}
		if(guiElement.type === "adjustbox" && !Mouse.drag && (Option.active===null || Option.active===guiElement)){
			if(clicked){
				if(MouseOver(guiElement)){
					if(Mouse.x>=guiX && Mouse.x<guiX+guiElement.width*0.25){
						SetAdjustBox(CurrentMenu(),guiElement,-1);
						return false;
					}
					if(Mouse.x>=guiX+guiElement.width*0.75 && Mouse.x<guiX+guiElement.width){
						SetAdjustBox(CurrentMenu(),guiElement,1);
						return false;
					}
				} else if(Option.active===guiElement){
					Option.selected = Option.cancel;
					return true;
				}
			} else if(Option.active===null){
				if(MouseOver(guiElement)){
					Option.selected = guiElement;
					return true;
				}
			}
		}
		
		if(Option.active!==null)
			continue;
		
		if(Menu.subMenu===GUI.options){
			DzSlider.target = DzSlider.small;
			
			if(guiElement.type === "inputfield"){
				if(Mouse.drag){
					if(Option.selected===guiElement){
						DzSlider.target = DzSlider.large;
						let keyBind = KeyBindings[KeyBind.player][guiElement.inputType];
						keyBind.deadzone = Clamp((Mouse.x-Screen.scaledWidthHalf-guiElement.xDiff)/guiElement.width, 0, 1);
					}
				} else {
					if(MouseOver(guiElement)){
						Option.selected = guiElement;
						let dzSliderPosX = (guiElement.width-DzSlider.large)*KeyBindings[KeyBind.player][guiElement.inputType].deadzone;
						if(Mouse.x>=guiX+dzSliderPosX)
						if(Mouse.x<guiX+dzSliderPosX+DzSlider.large){
							DzSlider.target = DzSlider.large;
							if(clicked)
								Mouse.drag = true;
							return false;
						}
						return true;
					}
				}
			}
		} else if(Menu.subMenu===GUI.battle){
			if(guiElement.type === "stagebutton"){
				if(!MouseOver(GUI.battle.background[0]))
					break;
				
				if(MouseOver(guiElement)){
					Option.selected = guiElement;
					return true;
				}
			}
		}
		
		if(Mouse.drag)
			continue;
		
		if(guiElement.type === "button" || guiElement.type === "checkbox"){
			if(MouseOver(guiElement)){
				Option.selected = guiElement;
				return true;
			}
		}
	}
	return false;
}
function SetAdjustBox(menu,option,change){
	let oldValue = option.value;
	option.value = Clamp(option.value+change*option.mod, option.min, option.max);
	if(oldValue!==option.value)
		PlaySound(Sounds.select);
}
function SetAdjustNumber(adjustBox, adjustNumber){
	adjustNumber = Clamp(adjustNumber, 0, Math.pow(10,adjustBox.number.length)-1);
	
	if(Math.floor(adjustNumber/100)>=1){
		adjustBox.number[2].data = Numbers[1];
		adjustBox.number[1].data = Numbers[0];
		adjustBox.number[0].data = Numbers[0];
	} else {
		if(adjustBox.number.length > 2)
			adjustBox.number[2].data = Disable;
		
		if(Math.floor(adjustNumber/10)>=1){
			adjustBox.number[1].data = Numbers[Math.floor(adjustNumber/10)];
			adjustBox.number[0].data = Numbers[adjustNumber-Math.floor(adjustNumber/10)*10];
		} else {
			if(adjustBox.number.length > 1)
				adjustBox.number[1].data = Disable;
			
			adjustBox.number[0].data = Numbers[adjustNumber];
		}
	}
}
function MainMenu(){
	if(Option.select && Menu.subMenu===null){
		Option.select=false;
		if(Option.selected.hasOwnProperty("menu")){
			Option.last = Option.selected;
			GUI[Option.selected.menu].run();
		}
	}
	
	LogoDraw();
	
	RenderElements(GUI.main);
	
	if(Menu.subMenu !== null)
		Menu.subMenu.run();
}
function Adventure(){
	if(Menu.subMenu!==GUI.adventure){
		Game.mode=GameMode.adventure;
		Menu.subMenu = GUI.adventure;
		Option.selected = GUI.adventure.button[0];
		playerConfirm = true;
		for(let pl = 1; pl < Players.length; pl++)
			Players[pl].joined = false;
		firstJoined = 0;
		GUI.adventure.title.targetHeight = 300; //playerConfirm targetHeight
		GUI.adventure.title.yDiff=GUI.adventure.title.orgYdiff;
		GUI.adventure.title.xDiff=GUI.adventure.title.orgXdiff;
		ShowMenu(GUI.adventure.title);
	}
	if(Option.select){
		Option.select=false;
		if(Option.selected===Option.cancel || Option.selected.cancel){
			playerConfirm = false;
			HideMenu(GUI.adventure.title);
		} else if(Option.selected===GUI.adventure.button[0] && !playerConfirm){
			CloseAllMenus();
			InitializeGame(0);
		}
	}
	
	RenderMenu(GUI.adventure.title);
	
	if(!Menu.animating){
		if(playerConfirm)
			PlayerConfirmWindow();
		else
			RenderElements(GUI.adventure);
	}
}
function Battle(){
	if(Menu.subMenu!==GUI.battle){
		Game.mode=GameMode.battle;
		Menu.subMenu = GUI.battle;
		Option.selected = GUI.battle.dropdown[0];
		playerConfirm = true;
		for(let pl = 1; pl < Players.length; pl++)
			Players[pl].joined = false;
		firstJoined = 0;
		GUI.battle.title.targetHeight = 300; //playerConfirm targetHeight
		GUI.battle.title.yDiff=GUI.battle.title.orgYdiff;
		GUI.battle.title.xDiff=GUI.battle.title.orgXdiff;
		ShowMenu(GUI.battle.title);
	}
	if(Option.select){
		Option.select=false;
		if(Option.active===null){
			if(Option.selected===Option.cancel || Option.selected.cancel){
				playerConfirm = false;
				HideMenu(GUI.battle.title);
			} else if(!playerConfirm){
				if(Option.selected.type==="dropdown"){
					Option.active = Option.selected;
					Option.active.selectedItem = Option.active.activeItem;
					ShowMenu(Option.active);
				} else if(Option.selected.type==="adjustbox")
					Option.active = Option.selected;
				else if(Option.selected.type==="checkbox")
					Option.selected.value=!Option.selected.value;
				else if(Option.selected===GUI.battle.button[0] || Option.selected===GUI.battle.button[1]){
					let columnDir = (Option.selected===GUI.battle.button[0]) ? -1 : 1;
					let newColumnCount = Clamp(stageColumnCount+columnDir, 1, Math.max(Stages.length,3));
					if(stageColumnCount !== newColumnCount){
						stageColumnCount = newColumnCount;
						stageRow += Math.floor(stageRow/stageColumnCount)*(-columnDir);
						stageRow = Clamp(stageRow, 0, GetLastStageRow());
						stageRowStep = stageRow; //instant stageRow position set
					}
				} else {
					CloseAllMenus();
					InitializeGame(Option.selected.stage);
				}
			}
		} else if(Option.active===GUI.battle.dropdown[0]){
			if(Option.selected!==Option.cancel)
				Game.type = Option.active.selectedItem;
			HideMenu(Option.active);
		} else {
			Option.selected = Option.active;
			Option.active = null;
		}
	}
	
	RenderMenu(GUI.battle.title);
	
	if(!Menu.animating || Option.active===GUI.battle.dropdown[0]){
		if(playerConfirm)
			PlayerConfirmWindow();
		else {
			GUI.battle.dropdown[0].activeItem = Game.type;
			GUI.battle.adjustbox[0].guiState = (Game.type===GameType.score) ? GUIstate.Enabled : GUIstate.Hidden;
			GUI.battle.adjustbox[1].guiState = (Game.type===GameType.life) ? GUIstate.Enabled : GUIstate.Hidden;
			GUI.battle.label[2].guiState = (Game.type===GameType.score) ? GUIstate.Enabled : GUIstate.Hidden;
			GUI.battle.label[3].guiState = (Game.type===GameType.life) ? GUIstate.Enabled : GUIstate.Hidden;
			
			for(let adjustbox of GUI.battle.adjustbox)
				SetAdjustNumber(adjustbox, adjustbox.value);
			
			for(let checkbox of GUI.battle.checkbox)
				checkbox.data = (checkbox.value) ? Enable : Disable;
			
			RenderElements(GUI.battle);
			
			let bgElement = GUI.battle.background[0];
			
			tempCanvas.width = bgElement.width*Screen.guiScale; //Screen.guiScale keeps stageIcons sharp in high screen resolutions
			tempCanvas.height = bgElement.height*Screen.guiScale;
			tempRender.scale(Screen.guiScale,Screen.guiScale);
			
			if(!Menu.animating)
				stageRowStep = AnimateValue(stageRowStep,stageRow);
			
			let startIndex = Math.floor(stageRowStep)*stageColumnCount;
			let endIndex = Math.ceil(stageRowStep)*stageColumnCount+stageColumnCount*stageColumnCount;
			for(let i = 0; i < Stages.length; i++){ //rendering stagebuttons
				let guiElement = GUI.battle.stagebutton[i];
				
				let iconGap = 2;
				
				let iconBgWidth = (bgElement.width-iconGap*stageColumnCount)/stageColumnCount;
				let iconBgHeight = (bgElement.height-iconGap*stageColumnCount)/stageColumnCount;
				guiElement.width = iconBgWidth;
				guiElement.height = iconBgHeight;
				
				let bgPosX = (iconBgWidth+iconGap)*i - (iconBgWidth+iconGap)*stageColumnCount*Math.floor(i/stageColumnCount);
				let bgPosY = (iconBgHeight+iconGap) * Math.floor(i/stageColumnCount) - (iconBgHeight+iconGap)*stageRowStep;
				guiElement.xDiff = bgPosX;
				guiElement.yDiff = bgPosY;
				
				if(i >= startIndex && i < endIndex){ //only rendering visible icons
					let iconWithoutBorderWidth = iconBgWidth-guiElement.border*2;
					let iconWithoutBorderHeight = iconBgHeight-guiElement.border*2;
					
					let iconWidth = Math.min(iconWithoutBorderHeight*(Stages[i].naturalWidth/Stages[i].naturalHeight),iconWithoutBorderWidth);
					let iconHeight = Math.min(iconWithoutBorderWidth*(Stages[i].naturalHeight/Stages[i].naturalWidth),iconWithoutBorderHeight);
					
					let iconPosX = bgPosX+(iconBgWidth-iconWidth)/2;
					let iconPosY = bgPosY+(iconBgHeight-iconHeight)/2;
					
					tempRender.fillStyle=(Option.selected===guiElement) ? Color.optionBorderHgl : Color.optionBorder;
					tempRender.fillRect(bgPosX,bgPosY,iconBgWidth,iconBgHeight);
					
					tempRender.fillStyle="#000000";
					tempRender.fillRect(iconPosX,iconPosY,iconWidth,iconHeight);
					
					tempRender.drawImage(Stages[i],iconPosX,iconPosY,iconWidth,iconHeight);
				}
			}
			
			guiRender.drawImage(tempCanvas,Screen.scaledWidthHalf+bgElement.xDiff,Screen.scaledHeightHalf+bgElement.yDiff,bgElement.width,bgElement.height);
			
			if(loadStageCount > 0){
				guiRender.fillStyle="#FF0000AA";
				guiRender.font="40px Arial";
				guiRender.textAlign="center";
				let loadingText = (loadStageCount===1) ? "Loading image" : ("Loading " + loadStageCount + " images");
				guiRender.fillText(loadingText,Screen.scaledWidthHalf+bgElement.xDiff+bgElement.width/2,Screen.scaledHeightHalf+bgElement.yDiff+bgElement.height/2);
			}
		}
	}
}
function Options(){
	if(Menu.subMenu!==GUI.options){
		Menu.subMenu = GUI.options;
		Option.selected = GUI.options.adjustbox[0];
		ShowMenu(GUI.options.title);
	}
	if(Option.select){
		Option.select=false;
		if(Option.active===null){
			if(Option.selected===Option.cancel || Option.selected.cancel){
				SaveGame();
				HideMenu(GUI.options.title);
			} else if(Option.selected.type==="adjustbox")
				Option.active = Option.selected;
			else if(Option.selected.hasOwnProperty("player")){ //playerButtons
				KeyBind.player = Option.selected.player;
				UpdateInputMethodMenu();
			} else if(Option.selected.type==="inputfield"){ //hasOwnProperty("inputType") also works
				if(Players[KeyBind.player].inputMethod!==-1){
					Option.active = Option.selected;
					StartKeyBind(Option.selected.inputType,true);
				}
			} else if(Option.selected.parent.type==="inputfield"){ //inputField add buttons
				if(Players[KeyBind.player].inputMethod!==-1){
					Option.active = Option.selected;
					StartKeyBind(Option.selected.parent.inputType,false);
				}
			} else if(Option.selected.type==="dropdown"){
				Option.active = Option.selected;
				Option.active.selectedItem = Option.active.activeItem;
				ShowMenu(Option.active);
			} else if(Option.selected.type==="checkbox")
				Option.selected.value=!Option.selected.value;
		} else if(Option.active===GUI.options.dropdown[0]){
			let selectedInputMethod = Option.active.selectedItem;
			if(selectedInputMethod!==Option.active.activeItem && Option.selected!==Option.cancel){ //if 1st condition is removed: always resets current keyBindings when any inputMethod is chosen
				if(selectedInputMethod<InputMethods.length){
					Players[KeyBind.player].inputInfo = {id:InputMethods[selectedInputMethod].id, index:InputMethods[selectedInputMethod].index};
					KeyBindings[KeyBind.player] = GetDefaultBindings((selectedInputMethod===0) ? defaultKeyboard : defaultGamepad);
				} else
					Players[KeyBind.player].inputInfo = {id:"noinput", index:null};
				
				UpdateInputMethods();
				for(let player of Players)
					player.confirmKey = false;
			}
			HideMenu(Option.active);
		} else {
			Option.selected = Option.active;
			Option.active = null;
		}
	}
	
	RenderMenu(GUI.options.title);
	
	if(!Menu.animating || Option.active===GUI.options.dropdown[0]){
		if(Option.selected!==Option.cancel && Players[KeyBind.player].inputMethod===-1 && (Option.selected.type==="inputfield" || Option.selected.parent.type==="inputfield"))
			Option.selected = GUI.options.adjustbox[0]; //if gamepad is disconnected while an inputfield is selected
		
		for(let i = 0; i < GUI.options.label.length; i++)
			GUI.options.label[i].guiState = (Players[KeyBind.player].inputMethod!==-1 || i<5) ? GUIstate.Enabled : GUIstate.Disabled;
		
		SetAdjustNumber(GUI.options.adjustbox[0], Math.round(Game.soundVolume*100));
		SetAdjustNumber(GUI.options.adjustbox[1], Screen.pixelScale);
		SetAdjustNumber(GUI.options.adjustbox[2], Math.floor((6-Game.updateInterval)*20));
		
		for(let checkbox of GUI.options.checkbox)
			checkbox.data = (checkbox.value) ? Enable : Disable;
		
		let guiElement = GUI.options.background[0]; //StickAim test area
		guiElement.guiState = (Players[KeyBind.player].inputMethod!==-1) ? GUIstate.Enabled : GUIstate.Disabled;
		let childElement = guiElement.background[0];
		childElement.guiState = guiElement.guiState; //StickAim test area dot
		childElement.xDiff = guiElement.width/2-(childElement.width/2)+((guiElement.width/2-childElement.width/2-guiElement.border)*Players[KeyBind.player].aimAxisX);
		childElement.yDiff = guiElement.height/2-(childElement.height/2)+((guiElement.height/2-childElement.height/2-guiElement.border)*Players[KeyBind.player].aimAxisY);
		
		if(Players[KeyBind.player].inputMethod!==-1 && !Menu.animating)
			DzSlider.width = AnimateValue(DzSlider.width,DzSlider.target);
		
		for(let guiElement of GUI.options.inputfield){
			guiElement.guiState = (Players[KeyBind.player].inputMethod!==-1) ? GUIstate.Enabled : GUIstate.Disabled;
			guiElement.button[0].guiState = guiElement.guiState; //add-button
			if(guiElement.guiState === GUIstate.Enabled){
				let keyBind = KeyBindings[KeyBind.player][guiElement.inputType];
				guiElement.axisValue = keyBind.value;
				
				let inputName = keyBind.name;
				if(KeyBind.inProgress && KeyBind.inputType===guiElement.inputType)
					inputName = KeyBind.text;
				else if(keyBind.deadzone===1)
					inputName = "[disabled]";
				guiElement.pText = inputName;
				
				guiElement.deadzone = keyBind.deadzone;
			} else
				guiElement.pText = "";
		}
		
		for(let guiElement of GUI.options.button){
			if(guiElement.hasOwnProperty("player")){
				let playerIsActive = (KeyBind.player === guiElement.player);
				guiElement.textColor = (playerIsActive) ? guiElement.textHglColor : PlayerColor[guiElement.player].color;
				guiElement.bgColor = (playerIsActive) ? PlayerColor[guiElement.player].color : Color.optionBg;
				guiElement.bgHglColor = (playerIsActive) ? PlayerColor[guiElement.player].color : PlayerColor[guiElement.player].fade;
			}
		}
		
		let inputDropdown = GUI.options.dropdown[0];
		inputDropdown.bgColor = Color.optionBg;
		inputDropdown.bgHglColor = PlayerColor[KeyBind.player].fade;
		let gradientX1 = Screen.scaledWidthHalf+inputDropdown.xDiff;
		let gradientX2 = gradientX1+inputDropdown.width;
		for(let method = 0; method < InputMethods.length; method++){
			let inputPlayers = InputMethods[method].players;
			if(inputPlayers.length > 0 && inputPlayers[0]!==0){
				let playerGradient = guiRender.createLinearGradient(gradientX1,0,gradientX2,0);
				for(let ip = 0; ip < inputPlayers.length; ip++)
					playerGradient.addColorStop((inputPlayers.length>1) ? ip/(inputPlayers.length-1) : 0, PlayerColor[inputPlayers[ip]].fade);
				inputDropdown.item[method].bgColor = playerGradient;
				inputDropdown.item[method].bgHglColor = playerGradient;
				if(inputPlayers.includes(KeyBind.player) && Option.active!==inputDropdown){
					inputDropdown.bgColor = playerGradient;
					inputDropdown.bgHglColor = playerGradient;
				}
			}
		}
		
		RenderElements(GUI.options);
	}
}
function Pause(){
	if(!Game.pause){
		StopAllSounds();
		Game.pause = true;
		Menu.active = GUI.pause;
		Menu.animating = true; //prevent GuiNavInput on the same frame
		Option.selected = GUI.pause.button[0];
	}
	if(Option.select && Menu.subMenu===null){
		Option.select=false;
		if(Option.selected.hasOwnProperty("menu")){
			Option.last = Option.selected;
			GUI[Option.selected.menu].run();
		} else if(Option.selected===GUI.pause.button[0] || Option.selected===Option.cancel){
			CloseAllMenus();
			Game.pause = false;
		}
	}
	
	RenderGame();
	
	LogoDraw();
	
	RenderElements(GUI.pause);
	
	if(Menu.subMenu !== null)
		Menu.subMenu.run();
}
function ExitGame(){
	if(Menu.subMenu!==GUI.exitGame){
		Menu.subMenu = GUI.exitGame;
		Option.selected = GUI.exitGame.button[0];
		
		GUI.exitGame.label[0].guiState = (Game.mode===GameMode.adventure) ? GUIstate.Enabled : GUIstate.Hidden;
		GUI.exitGame.label[1].guiState = (Game.mode===GameMode.battle) ? GUIstate.Enabled : GUIstate.Hidden;
		
		GUI.exitGame.title.yDiff=GUI.exitGame.title.orgYdiff;
		GUI.exitGame.title.xDiff=GUI.exitGame.title.orgXdiff;
		ShowMenu(GUI.exitGame.title);
	}
	if(Option.select){
		Option.select=false;
		if(Option.selected===Option.cancel || Option.selected.cancel)
			HideMenu(GUI.exitGame.title);
		else if(Option.selected===GUI.exitGame.button[1]){
			Game.started = false;
			Menu.active = GUI.main;
			if(Game.mode===GameMode.adventure){
				Menu.subMenu = null;
				Option.selected = GUI.main.button[0];
			} else {
				Menu.subMenu = GUI.battle;
				Option.last = GUI.main.button[1];
				Option.selected = GUI.battle.stagebutton[Game.levelIndex];
				ShowMenu(GUI.battle.title);
			}
		}
	}
	
	RenderMenu(GUI.exitGame.title);
	
	if(!Menu.animating)
		RenderElements(GUI.exitGame);
}
function Results(){
	if(Menu.active!==GUI.results){
		StopAllSounds();
		PlaySound(Sounds.death);
		Game.pause = true;
		Game.started = false;
		Menu.active = GUI.results;
		Option.selected = GUI.results.button[0];
		
		let Winners = [];
		for(let pl = 1; pl < Players.length; pl++){
			if(!Players[pl].joined)
				continue;
			if(Winners.length===0 || Players[pl].score < Players[Winners[Winners.length-1][0]].score)
				Winners.push([Players[pl].number]);
			else {
				for(let w = 0; w < Winners.length; w++){
					if(Players[pl].score === Players[Winners[w][0]].score){
						Winners[w].push([Players[pl].number]);
						break;
					}
					if(Players[pl].score > Players[Winners[w][0]].score){
						Winners.splice(w,0,[Players[pl].number]);
						break;
					}
				}
			}
		}
		
		for(let background of GUI.results.background)
			background.guiState = GUIstate.Hidden;
		
		let sizeDiff = 50;
		for(let w = 0; w < Winners.length; w++){
		for(let wi = 0; wi < Winners[w].length; wi++){ //if multiple players have the same score
			let playerBar = GUI.results.background[Winners[w][wi]-1];
			playerBar.guiState = GUIstate.Enabled;
			
			let barLabel = playerBar.label[0];
			barLabel.data = WinnerTexts[w];
			if(w===0){
				barLabel.textWidth = 15;
				barLabel.textHeight = 14;
				barLabel.textXoffset = 8;
			} else if(w===1){
				barLabel.textWidth = 12;
				barLabel.textHeight = 11;
				barLabel.textXoffset = 9;
			} else if(w===2){
				barLabel.textWidth = 9;
				barLabel.textHeight = 8;
				barLabel.textXoffset = 30;
			} else if(w===3){
				barLabel.textWidth = 6;
				barLabel.textHeight = 5;
				barLabel.textXoffset = 42;
			}
			
			playerBar.yDiff = playerBar.orgYdiff+sizeDiff*w;
			playerBar.height = playerBar.orgHeight-sizeDiff*w;
			playerBar.textYoffset = sizeDiff*(4-w)-playerBar.border*2;
		}
		}
		
		ShowMenu(GUI.results.title);
	}
	if(Option.select){
		Option.select=false;
		if(Option.selected.hasOwnProperty("menu")){
			Menu.active = GUI.main;
			if(GUI[Option.selected.menu]===GUI.battle){
				Menu.subMenu = GUI.battle;
				Option.last = GUI.main.button[1];
				Option.selected = GUI.battle.stagebutton[Game.levelIndex];
				ShowMenu(GUI.battle.title);
			} else //mainMenu
				Option.selected = GUI.main.button[1];
		} else if(Option.selected===GUI.results.button[0]){
			CloseAllMenus();
			InitializeGame(Game.levelIndex);
		}
	}
	
	RenderGame();
	
	RenderMenu(GUI.results.title);
	
	if(!Menu.animating)
		RenderElements(GUI.results);
	
}
function RenderPlainText(element){
	if(element.pText === "" || element.guiState === GUIstate.Hidden)
		return;
	
	guiRender.fillStyle=element.pTextColor;
	guiRender.font=element.pFontSize+"px Arial";
	guiRender.textAlign=element.pTextAlign;
	
	let textXpos = Screen.scaledWidthHalf+element.xDiff+element.pTextXoffset+(element.parent.xDiff || 0); //?? 0
	let textYpos = Screen.scaledHeightHalf+element.yDiff+element.pTextYoffset+(element.parent.yDiff || 0); //?? 0
	
	if(guiRender.textAlign === "right" || guiRender.textAlign === "end")
		textXpos += element.width;
	else if(guiRender.textAlign === "center")
		textXpos += element.width/2;
	
	textYpos += element.height;
	
	if(element.pTextWidth===0)
		guiRender.fillText(element.pText,textXpos,textYpos);
	else
		guiRender.fillText(element.pText,textXpos,textYpos,element.pTextWidth-Math.abs(element.pTextXoffset*2));
}
function RenderText(element){
	if(element.guiState === GUIstate.Hidden)
		return;
	
	if(element.data !== null){
		guiRender.beginPath();
		guiRender.lineWidth = element.textBorder*2;
		guiRender.setLineDash([]);
		guiRender.strokeStyle = element.textBorderColor;
		
		if(element.selected)
			guiRender.fillStyle = element.textHglColor;
		else if(element.guiState === GUIstate.Enabled)
			guiRender.fillStyle = element.textColor;
		else
			guiRender.fillStyle = element.textFadeColor;
		
		for(let py = 0; py < element.data.length; py++){
			for(let px = 0; px < element.data[py].length; px++){
				if(element.data[py][px] === 1){
					guiRender.rect(
						Screen.scaledWidthHalf+element.xDiff+element.textXoffset+px*(element.textWidth+element.textXgap)+(element.parent.xDiff || 0), //?? 0
						Screen.scaledHeightHalf+element.yDiff+element.textYoffset+py*(element.textHeight+element.textYgap)+(element.parent.yDiff || 0), //?? 0
						element.textWidth,
						element.textHeight
					);
				}
			}
		}
		
		if(element.textBorder>0)
			guiRender.stroke();
		
		guiRender.fill();
	}
	RenderPlainText(element);
}
function RenderOption(element){
	if(element.guiState === GUIstate.Hidden)
		return;
	
	if(element.selected){
		guiRender.strokeStyle = element.borderHglColor;
		guiRender.fillStyle = element.bgHglColor;
	} else if(element.guiState === GUIstate.Enabled){
		guiRender.strokeStyle = element.borderColor;
		guiRender.fillStyle = element.bgColor;
	} else {
		guiRender.strokeStyle = element.borderFadeColor;
		guiRender.fillStyle = element.bgFadeColor;
	}
	
	let rectX = Screen.scaledWidthHalf+element.xDiff+element.border/2-element.padding+(element.parent.xDiff || 0); //?? 0
	let rectY = Screen.scaledHeightHalf+element.yDiff+element.border/2-element.padding+(element.parent.yDiff || 0); //?? 0
	let rectW = element.width-element.border+element.padding*2;
	let rectH = element.height-element.border+element.padding*2;
	
	guiRender.beginPath();
	guiRender.rect(rectX,rectY,rectW,rectH);
	guiRender.fill();
	
	if(element.border>0){
		guiRender.lineWidth = element.border;
		guiRender.setLineDash([]);
		guiRender.stroke();
	}
	
	RenderText(element);
	
	RenderElements(element); //for child-elements
}
function RenderElements(parentGUI){ //elements are rendered in this order
	if(parentGUI.hasOwnProperty("background")){
		for(let background of parentGUI.background)
			RenderOption(background);
	}
	if(parentGUI.hasOwnProperty("label")){
		for(let label of parentGUI.label)
			RenderText(label);
	}
	if(parentGUI.hasOwnProperty("number")){
		for(let number of parentGUI.number){
			number.selected = (Option.active===parentGUI);
			RenderText(number);
		}
	}
	let elementTypes = Object.getOwnPropertyNames(parentGUI);
	for(let elementType of elementTypes){ //rest of the elements
		if(elementType !== "button" && elementType !== "checkbox" && elementType !== "inputfield" && elementType !== "adjustbox")
			continue; //stagebuttons are rendered manually and dropdowns are rendered last
		for(let element of parentGUI[elementType]){ //only checking elements that are inside an array (ignores title)
			if(GUI[element.menu]===CurrentMenu())
				continue;
			
			element.selected = (Option.selected===element);
			
			RenderOption(element);
			
			if(element.guiState !== GUIstate.Enabled)
				continue;
			
			if(elementType === "inputfield"){
				for(let axis = 0; axis < element.axisValue.length; axis++){
					let barHeight = (element.height-element.border*2)/element.axisValue.length;
					guiRender.fillStyle="#CCCC00"; //"#FFFF00CC" and remove RenderPlainText?
					guiRender.fillRect(
						Screen.scaledWidthHalf+element.xDiff+element.border,
						Screen.scaledHeightHalf+element.yDiff+element.border+barHeight*axis,
						(element.width-element.border*2)*element.axisValue[axis],
						barHeight
					); //AxisValue-bar
				}
				
				RenderPlainText(element);
				
				guiRender.fillStyle="#FF0000";
				guiRender.fillRect(
					Screen.scaledWidthHalf+element.xDiff+((element.width-DzSlider.width)*element.deadzone),
					Screen.scaledHeightHalf+element.yDiff,
					DzSlider.width,
					element.height
				); //Deadzone-line
			}
		}
	}
	if(parentGUI.hasOwnProperty("dropdown")){
		for(let element of parentGUI.dropdown){
			element.selected = (Option.selected===element && Option.active!==element);
			element.pText = (Option.active!==element) ? element.item[element.activeItem].pText : "";
			element.targetHeight = element.item.length*element.orgHeight;
			RenderOption(element);
			
			if(Option.active===element && !Menu.animating){
				element.width = element.targetWidth;
				element.height = element.targetHeight;
				let itemHeight = (element.height-element.border*2)/element.item.length;
				let itemIndex = 1;
				for(let item = 0; item < element.item.length; item++){
					let yDis = element.border;
					if(element.activeItem !== item){ //not active item (active item is at the top of the list)
						yDis += itemIndex*itemHeight;
						itemIndex++;
					}
					element.item[item].xDiff = element.border;
					element.item[item].yDiff = yDis;
					element.item[item].width = element.width-element.border*2;
					element.item[item].pTextWidth = element.item[item].width;
					element.item[item].height = itemHeight;
					element.item[item].pTextAlign = element.pTextAlign;
					element.item[item].pFontSize = element.pFontSize;
					element.item[item].pTextXoffset = element.pTextXoffset;
					element.item[item].pTextYoffset = -itemHeight/2+element.pFontSize*0.3; //wow
					
					element.item[item].selected = (element.selectedItem===item);
					
					RenderOption(element.item[item]);
				}
			}
		}
	}
}
function RenderMenu(element){
	guiRender.beginPath();
	guiRender.lineWidth = element.border;
	guiRender.setLineDash([]);
	guiRender.strokeStyle = element.borderColor;
	guiRender.fillStyle = element.bgColor;
	
	guiRender.rect(
		Screen.scaledWidthHalf+element.xDiff+element.border/2,
		Screen.scaledHeightHalf+element.yDiff+element.border/2,
		element.width-element.border,
		element.height-element.border
	);
	guiRender.fill();
	
	if(element.border>0)
		guiRender.stroke();
	
	guiRender.beginPath();
	let cancelKey = (Option.selected===Option.cancel && Option.active===null); //title is also highlighted when cancel-key is pressed
	guiRender.strokeStyle = (cancelKey || Option.selected===element) ? element.borderHglColor : element.borderColor;
	guiRender.fillStyle = element.fgColor;
	guiRender.rect(
		Screen.scaledWidthHalf+element.xDiff+element.border/2,
		Screen.scaledHeightHalf+element.yDiff+element.border/2,
		element.orgWidth-element.border,
		element.orgHeight-element.border
	); //titleBg
	guiRender.fill();
	
	if(element.border>0)
		guiRender.stroke();
	
	RenderText(element);
}
function AnimateValue(current,target,animForce=defaultAnimForce,animThreshold=0,animSteps={steps:Game.steps}){ //animSteps for framerate independency
	if(current===target)
		return current;
	
	let animDistance = target-current;
	let multipliedAnimForce = animForce*Game.speedMultiplier;
	let multipliedAnimThreshold = animThreshold*Game.speedMultiplier;
	
	while(animSteps.steps >= 1){
		animSteps.steps--;
		current+=animDistance*multipliedAnimForce;
		current+=Math.sign(animDistance)*multipliedAnimThreshold;
		
		let newAnimDistance = target-current;
		if(Math.sign(newAnimDistance)!==Math.sign(animDistance)){ //|| Math.abs(newAnimDistance)<multipliedAnimThreshold ?
			current=target;
			break;
		}
		animDistance = newAnimDistance;
	}
	return current;
}
function AnimateElement(element,animProperties){
	let animationDone = true;
	let animSteps = {steps:Game.steps};
	for(let animProperty of animProperties){
		let prop = animProperty[0];
		let target = animProperty[1];
		
		element[prop] = AnimateValue(element[prop],element[target],Menu.animForce,Menu.animThreshold,animSteps);
		
		if(element[prop]!==element[target]){
			animationDone=false;
			if(!GUI.logo.secret) //animSteps.steps is < 1 so break to avoid unnecessary loop iterations
				break;
		}
		if(GUI.logo.secret)
			animSteps.steps = Game.steps;
	}
	return animationDone;
}
function AnimateMenu(){
	if(Menu.animMenu===null){ //failsafe
		Menu.animating = false;
		return;
	}
	let animProperties = (Menu.animMenu.show) ?
	[["xDiff","targetXdiff"],["yDiff","targetYdiff"],["width","targetWidth"],["height","targetHeight"]] :
	[["height","orgHeight"],["width","orgWidth"],["yDiff","orgYdiff"],["xDiff","orgXdiff"]];
	
	Menu.animating = !AnimateElement(Menu.animMenu.menu,animProperties);
	if(!Menu.animating){
		if(!Menu.animMenu.show){
			if(Option.active===null){ //submenu active
				Option.selected = Option.last;
				Menu.subMenu = null;
			} else //option active
				Option.selected = Option.active;
			
			Option.active = null;
		}
		Menu.animMenu = null;
	}
}
function ShowMenu(element){
	if(!Menu.animating){
		element.width = element.orgWidth;
		element.height = element.orgHeight;
		Menu.animating = true;
		Menu.animMenu = {menu:element,show:true};
	}
}
function HideMenu(element){
	if(!Menu.animating){
		Menu.animating = true;
		Menu.animMenu = {menu:element,show:false};
	}
}
function PlayerConfirmWindow(){
	for(let pl = 1; pl < Players.length; pl++){
		let playerSlot = GUI.playerConfirm.background[pl-1];
		
		playerSlot.selected = playerSlot.background[0].selected = Players[pl].joined;
		playerSlot.guiState = playerSlot.background[0].guiState = ((Players[pl].inputMethod!==-1) ? GUIstate.Enabled : GUIstate.Disabled);
		
		playerSlot.background[0].pFontSize = playerSlot.background[0].orgPfontSize;
		if(playerSlot.selected)
			playerSlot.background[0].pText = "OK";
		else if(playerSlot.guiState === GUIstate.Enabled){
			let keyText = ""+KeyBindings[Players[pl].number][Input.confirm].name;
			playerSlot.background[0].pFontSize = "bold "+Math.floor(260/(keyText.length+12));
			playerSlot.background[0].pText = "Press "+keyText+" to join";
		} else
			playerSlot.background[0].pText = "No input";
	}
	
	if(firstJoined !== 0){
		GUI.playerConfirm.label[1].pText = "P"+firstJoined+": Press "+KeyBindings[firstJoined][Input.pause].name+" to continue";
		GUI.playerConfirm.label[1].guiState = GUI.playerConfirm.label[2].guiState = GUIstate.Enabled;
	} else
		GUI.playerConfirm.label[1].guiState = GUI.playerConfirm.label[2].guiState = GUIstate.Hidden;
	
	RenderElements(GUI.playerConfirm);
}
function ConfirmPlayers(){
	if(firstJoined === 0)
		return;
	
	guiNavInputs = [];
	playerConfirm = false;
	Option.selected = (Menu.subMenu===GUI.adventure) ? GUI.adventure.button[0] : GUI.battle.dropdown[0];
	
	let menuElement = (Menu.subMenu===GUI.adventure) ? GUI.adventure.title : GUI.battle.title;
	menuElement.targetHeight = menuElement.orgTargetHeight;
	Menu.animating = true;
	Menu.animMenu = {menu:menuElement,show:true};
	
	PlaySound(Sounds.confirm);
}
function KeyBindTimer(){
	if(KeyBind.inputType < Input.aimXneg)
		KeyBind.text = "Waiting input..."+KeyBind.time;
	else
		KeyBind.text = "Waiting..."+KeyBind.time;
	
	KeyBind.time--;
	if(KeyBind.time<0)
		StopKeyBind();
}
function StartKeyBind(inputType,reset){
	KeyBind.inProgress = true;
	KeyBind.inputType = inputType;
	KeyBind.reset = reset;
	
	gamepadTemp = {axisValues:[],buttonValues:[]};
	Mouse.startX = Mouse.x;
	Mouse.startY = Mouse.y;
	
	KeyBind.time = KeyBind.timeOut;
	KeyBindTimer();
	KeyBind.timer = setInterval(KeyBindTimer, 1000);
}
function StopKeyBind(){
	KeyBind.inProgress = false;
	
	gamepadTemp = null;
	Option.active = null;
	
	clearInterval(KeyBind.timer);
}
function SetKeyBind(name, input){
	let keyBind = KeyBindings[KeyBind.player][KeyBind.inputType];
	if(KeyBind.reset){
		keyBind.name = [];
		keyBind.input = [];
		keyBind.value = [];
	}
	if(!keyBind.input.includes(input)){
		keyBind.name.push(name);
		keyBind.input.push(input);
		keyBind.value.push(0);
	}
	if(Players[KeyBind.player].inputMethod>0){ //not keyboard&mouse
		for(let binding of KeyBindings[KeyBind.player])
			binding.blocked = new Array(binding.input.length).fill(true); //prevents immediate input after keybind
	}
}
function ResetKeyValues(){ //for save loading
	for(let pl = 0; pl < Players.length; pl++){
		for(let binding of KeyBindings[pl]){
			binding.value = new Array(binding.input.length).fill(0);
			binding.blocked = new Array(binding.input.length).fill(false);
		}
	}
}
function Clamp(value,min,max){
	return Math.min(Math.max(value, min), max);
}
function DebugInfo(){
	guiRender.fillStyle="#00FF00";
	guiRender.font="15px Arial";
	
	let xPos=4, yPos=0, yStep=20;
	guiRender.textAlign="left";
	
	if(Game.started && Menu.active===null){
		guiRender.fillText("Level: X:"+levelPosX.toFixed(1)+"  Y:"+levelPosY.toFixed(1)+"  Width:"+Terrain.canvas.width+"  Height:"+Terrain.canvas.height,xPos,yPos+=yStep);
		guiRender.fillText("[I/K|J/L]areaScale: "+areaScale.toFixed(4)+((Game.fixedCamera) ? "(fixed)" : "("+1*Game.aimArea.toFixed(2)+"|"+1*Game.aimMargin.toFixed(4)+")  [U/O]panMultiplier: "+Game.panMultiplier),xPos,yPos+=yStep);
		
		let pCount = 0;
		for(let p = 1; p < Players.length; p++){
			let player = Players[p];
			if(!player.joined)
				continue;
			
			yPos = pCount*90+50;
			guiRender.fillText("P"+p+") X:"+player.playerPosX.toFixed(1)+"  Y:"+player.playerPosY.toFixed(1)+"  Width:"+player.playerWidth+"  Height:"+player.playerHeight+"  SizeLevel:"+player.sizeLevel,xPos,yPos+=yStep);
			guiRender.fillText("PixelCount:"+player.pixelCount.toFixed(0)+"  PixelCountMax:"+player.pixelCountMax+"  BallCount:"+player.Balls.length,xPos+36,yPos+=yStep);
			guiRender.fillText("Momentum: X:"+player.momentumX.toFixed(3)+"  Y:"+player.momentumY.toFixed(3)+"  Rotation:"+player.rotMomentum.toFixed(3),xPos+36,yPos+=yStep);
			guiRender.fillText("JumpTimer: "+player.jumpTimer+"  OnGround: "+player.onGround,xPos+36,yPos+=yStep);
			
			pCount++;
		}
	}
	for(let p = 0; p < Players.length; p++){
		let playerInputs = KeyBindings[p].map(i => "["+i.value.map(v => +v.toFixed(3))+"]");
		guiRender.fillText("P"+p+") "+playerInputs,xPos,Screen.scaledHeight+20*(p-5));
	}
	
	xPos = Screen.scaledWidth-4; yPos = 20;
	guiRender.textAlign="right";
	guiRender.fillText("[N/M]pixelScale: "+Screen.pixelScale+"%(x"+Screen.deviceRatio+";"+Screen.pixelRatio+") [X]guiScale: "+Screen.guiScale.toFixed(4)+" [Z]smooth: "+Screen.smoothing+" [C]noClear: "+Screen.noClear+" [V]vsync: "+Screen.vsync,xPos,yPos+=yStep);
	guiRender.fillText("[Home/End]updateInterval: "+Game.updateInterval+"ms",xPos,yPos+=yStep);
	guiRender.fillText("[PgUp/PgDn]speedMultiplier: "+Game.speedMultiplier+"x",xPos,yPos+=yStep);
	guiRender.fillText("Mode: "+Object.keys(GameMode)[Game.mode]+" Type: "+Object.keys(GameType)[Game.type],xPos,yPos+=yStep);
	
	yPos = Screen.scaledHeight-270;
	guiRender.fillText("[`]fixedCamera: "+Game.fixedCamera,xPos,yPos+=yStep);
	guiRender.fillText("[1]noClip: "+Game.noClip,xPos,yPos+=yStep);
	guiRender.fillText("[2]noBounds: "+Game.noBounds,xPos,yPos+=yStep);
	guiRender.fillText("[3]noCollect: "+Game.noCollect,xPos,yPos+=yStep);
	guiRender.fillText("[4]noGrow: "+Game.noGrow,xPos,yPos+=yStep);
	guiRender.fillText("[5]noPile: "+Game.noPile,xPos,yPos+=yStep);
	guiRender.fillText("[6]noKnockback: "+Game.noKnockback,xPos,yPos+=yStep);
	guiRender.fillText("[7]collectCharge: "+Game.collectCharge,xPos,yPos+=yStep);
	guiRender.fillText("[8]instantCharge: "+Game.instantCharge,xPos,yPos+=yStep);
	guiRender.fillText("[9]wallJump: "+Game.wallJump,xPos,yPos+=yStep);
	guiRender.fillText("[0]infiniteJump: "+Game.infiniteJump,xPos,yPos+=yStep);
	guiRender.fillText("[-/=]shotSpeed: "+Game.shotSpeed,xPos,yPos+=yStep);
	guiRender.fillText("[G/H]stage: "+Game.levelIndex+"  [,]frameHold  [.]frameStep",xPos,yPos+=yStep);
	
	PerfInfo.Update(TimeNow());
	guiRender.fillText(1*Screen.width.toFixed(4)+"x"+1*Screen.height.toFixed(4)+" | "+PerfInfo.frameInfo+" | "+PerfInfo.fpsInfo,Screen.scaledWidth-5,20);
}
function LogoDraw(){
	let mouseIsDrawing = false;
	let GLogo = GUI.logo;
	if(Mouse.draw!==-1){
		GLogo.width = (GLogo.textWidth+GLogo.textXgap)*GLogo.data[0].length+GLogo.textXoffset;
		GLogo.height = (GLogo.textHeight+GLogo.textYgap)*GLogo.data.length+GLogo.textYoffset;
		
		if(MouseOver(GLogo)){
			let Ydis = Mouse.y-(Screen.scaledHeightHalf+GLogo.yDiff);
			let Xdis = Mouse.x-(Screen.scaledWidthHalf+GLogo.xDiff);
			let dataY = Math.floor(Ydis/GLogo.height*GLogo.data.length);
			let dataX = Math.floor(Xdis/GLogo.width*GLogo.data[0].length);
			let newData = (Mouse.draw===0) ? 1 : 0;
			
			if(GLogo.data[dataY][dataX] !== newData || !GLogo.drawStarted){
				GLogo.data[dataY][dataX] = newData;
				mouseIsDrawing = true;
			}
			//GLogo.secret=false; //not needed because there are almost always empty pixels in logo when secret is active
		}
	}
	if(GLogo.secret || mouseIsDrawing){
		GLogo.secret = GLogo.drawStarted;
		for(let py = 0; py < GLogo.data.length; py++){
			for(let px = 0; px < GLogo.data[py].length; px++){
				if(!GLogo.drawStarted)
					GLogo.data[py][px] = 0; //clear all pixels
				else if(!mouseIsDrawing) //GLogo.secret is true
					GLogo.data[py][px] = Math.floor(Math.random() * 2); //set random pixels
				else if(GLogo.data[py][px]===0)
					GLogo.secret = false;
			}
		}
		GLogo.drawStarted = true;
		if(GLogo.secret && mouseIsDrawing)
			Mouse.draw = -1;
	}
	let newBorder = (Mouse.draw!==-1) ? 1 : 0;
	if(GLogo.border !== newBorder){
		GLogo.border = newBorder;
		if(newBorder===0)
			LogoSave();
	}
	
	RenderOption(GLogo);
}
function LogoSave(){
	if(GUI.logo.drawStarted){
		localStorage.setItem('GUIlogo',JSON.stringify(GUI.logo.data));
		localStorage.setItem('GUIsecret',GUI.logo.secret);
	}
}
function LogoLoad(){
	let loadedGUIlogo = JSON.parse(localStorage.getItem('GUIlogo'));
	let loadedGUIsecret = localStorage.getItem('GUIsecret');
	
	if(loadedGUIlogo!==null){
		GUI.logo.data = loadedGUIlogo;
		GUI.logo.drawStarted = true;
		GUI.logo.secret = (loadedGUIsecret==="true");
	}
}
function SaveGame(){ //add exeption?: Can not save
	localStorage.setItem('vsync',Screen.vsync);
	localStorage.setItem('guiScaleOn',Screen.guiScaleOn);
	localStorage.setItem('pixelScale',Screen.pixelScale);
	localStorage.setItem('updateInterval',Game.updateInterval);
	localStorage.setItem('soundVolume',Game.soundVolume);
	localStorage.setItem('KeyBindings',JSON.stringify(KeyBindings));
	
	let PlayerInputInfo = [];
	for(let pl = 1; pl < Players.length; pl++)
		PlayerInputInfo.push({id:Players[pl].inputInfo.id, index:Players[pl].inputInfo.index});
	localStorage.setItem('PlayerInputInfo',JSON.stringify(PlayerInputInfo));
	
	//LogoSave(); //not needed
}
function LoadGame(){
	let loadedVsync = localStorage.getItem('vsync');
	let loadedGuiScaleOn = localStorage.getItem('guiScaleOn');
	let loadedPixelScale = localStorage.getItem('pixelScale');
	let loadedUpdateInterval = localStorage.getItem('updateInterval');
	let loadedSoundVolume = localStorage.getItem('soundVolume');
	let loadedKeyBindings = JSON.parse(localStorage.getItem('KeyBindings'));
	let loadedPlayerInputInfo = JSON.parse(localStorage.getItem('PlayerInputInfo'));
	
	if(loadedVsync!==null)
		Screen.vsync = (loadedVsync==="true");
	
	if(loadedGuiScaleOn!==null)
		Screen.guiScaleOn = (loadedGuiScaleOn==="true");
	
	if(loadedPixelScale!==null){
		loadedPixelScale = Number(loadedPixelScale);
		if(!Number.isNaN(loadedPixelScale)){
			Screen.pixelScale = loadedPixelScale;
		}
	}
	
	if(loadedUpdateInterval!==null){
		loadedUpdateInterval = Number(loadedUpdateInterval);
		if(!Number.isNaN(loadedUpdateInterval)){
			Game.updateInterval = loadedUpdateInterval;
			UpdateMultiplier(Game.updateInterval);
		}
	}
	
	if(loadedSoundVolume!==null){
		loadedSoundVolume = Number(loadedSoundVolume);
		if(!Number.isNaN(loadedSoundVolume)){
			Game.soundVolume = loadedSoundVolume;
		}
	}
	
	if(loadedKeyBindings!==null){
		KeyBindings = loadedKeyBindings;
		ResetKeyValues();
	}
	
	if(loadedPlayerInputInfo!==null){
		for(let pl = 1; pl < Players.length; pl++)
			Players[pl].inputInfo = loadedPlayerInputInfo[pl-1];
	}
	
	UpdateInputMethods();
	
	LogoLoad();
}
function InitializeLevels(){
	if(Loading.skipAdventure){
		for(let level of Levels)
			level.src = ""; //cancel load
		
		Levels = [];
		loadLevelCount = 0;
		initLevelCount = 0;
		return;
	}
	if(initLevelCount>1)	
		setTimeout(InitializeLevels, 0);
	
	let i = Levels.length-initLevelCount;
	
	Levels[i].canvas = document.createElement('canvas');
	Levels[i].canvas.width = Levels[i].naturalWidth;
	Levels[i].canvas.height = Levels[i].naturalHeight;
	
	if(i > 0){
		levelPosX += Levels[i-1].canvas.width;
		levelPosY += Math.min(Levels[i-1].canvas.height-Levels[i].canvas.height,0); //top of next level is always at the same height or higher than the previous one
	}
	Levels[i].xOffset = levelPosX;
	Levels[i].yOffset = levelPosY;
	
	Levels[i].render = GetRender(Levels[i].canvas);
	Levels[i].render.drawImage(Levels[i], 0, 0);
	
	Levels[i].colData = CreateColData(Levels[i].render.getImageData(0, 0, Levels[i].canvas.width, Levels[i].canvas.height).data);
	
	initLevelCount--;
}
tempCanvas.width = GUI.battle.background[0].width;
tempCanvas.height = GUI.battle.background[0].height;
function InitializeStages(){
	if(initStageCount>1)
		setTimeout(InitializeStages, 0);
	
	let i = Stages.length-initStageCount;
	
	tempRender.drawImage(Stages[i],0,0,tempCanvas.width,tempCanvas.height); //cache stages
	AddStageButton(i,Stages[i].naturalWidth,Stages[i].naturalHeight);
	
	initStageCount--;
}
function LoadingScreen(){
	let totalLoadCount = Levels.length*2+Stages.length*2+Object.keys(Sounds).length+Crosshair.length;
	Loading.progress = (totalLoadCount-loadLevelCount-loadStageCount-loadSoundCount-loadCrossCount-initLevelCount-initStageCount)/totalLoadCount;
	
	if(Stages.length>0 && !Loading.initStages && loadStageCount===0){
		Loading.initStages = true;
		InitializeStages();
	} if(Levels.length>0 && !Loading.initLevels && (loadLevelCount===0 || Loading.skipAdventure)){
		Loading.initLevels = true;
		InitializeLevels();
	}
	
	if(Loading.barProgress < 1)
		Loading.barProgress = AnimateValue(Loading.barProgress,Loading.progress,defaultAnimForce,0.0001);
	else if(!Loading.done){
		if(Levels.length===0){
			GUI.main.button[0].guiState = GUIstate.Disabled;
			Option.selected = GUI.main.button[1];
		} else
			Option.selected = GUI.main.button[0];
		
		Loading.done = true;
		Menu.active = GUI.main;
	}
	
	let barX = Screen.scaledWidthHalf-150;
	let barY = Screen.scaledHeightHalf-20;
	let barWidth = 300;
	let barHeight = 40;
	let barBorder = 2;
	let barInnerX = barX+barBorder;
	let barInnerY = barY+barBorder;
	let barInnerWidth = (barWidth-barBorder*2);
	let barInnerHeight = (barHeight-barBorder*2);
	
	guiRender.fillStyle = Color.menuBorder;
	guiRender.fillRect(barX, barY, barWidth, barHeight);
	
	guiRender.fillStyle = "#000000";
	guiRender.fillRect(barInnerX+barInnerWidth*Loading.barProgress, barInnerY, barInnerWidth*(1-Loading.barProgress), barInnerHeight);
	
	guiRender.fillStyle = "#FFFFFFCC";
	guiRender.font = "20px Arial";
	guiRender.textAlign = "left";
	guiRender.fillText("Version "+version,3,Screen.scaledHeight-3);
	
	let xPos=3, yPos=20, yStep=28;
	guiRender.fillText("- Drop an image file into the game to set it as the background",xPos,yPos);
	guiRender.fillText("- Add stages by dropping images at stage selection",xPos,yPos+=yStep);
	guiRender.fillText("- [ScrollLock] to enable DebugMode",xPos,yPos+=yStep);
	guiRender.fillText("- [F] or [F4] to enable fullscreen",xPos,yPos+=yStep);
	
	if(Loading.done){
		guiRender.fillStyle = "#000000";
		guiRender.font = "30px Arial";
		guiRender.textAlign = "center";
		guiRender.fillText("Click to start",Screen.scaledWidthHalf,Screen.scaledHeightHalf+10);
	} else if(!Loading.skipAdventure){
		guiRender.textAlign = "center";
		guiRender.fillText("(Click to skip Adventure load)",Screen.scaledWidthHalf,Screen.scaledHeightHalf+50);
	}
}
function CloseLoadingScreen(){
	if(Loading.inProgress){
		if(Loading.done)
			Loading.inProgress = false;
		else
			Loading.skipAdventure = true;
	}
}
function GameLoop(){ //main loop
	if(Screen.vsync)
		window.requestAnimationFrame(GameLoop);
	else
		setTimeout(GameLoop, 0);
	
	gameCanvas.style.cursor = (Game.started && Menu.active===null) ? 'none' : 'auto';
	
	CheckGamepads(); //polling gamepad inputs
	
	let currentTime = TimeNow();
	let deltaTime = Math.min(currentTime-Game.lastTime,10000); //10 second limit
	if((!Game.frameHold && (deltaTime>=Game.updateInterval)) || Game.frameStep){ //maximum UpdateRate (1ms)
		Game.steps = (Game.frameStep) ? 1 : deltaTime/Game.updateInterval + (Game.steps%1);
		Game.lastTime = currentTime;
		Game.frameStep = false;
		
		if(!Screen.noClear)
			gameRender.clearRect(0, 0, Screen.width, Screen.height);
		
		guiRender.clearRect(0, 0, Screen.scaledWidth, Screen.scaledHeight);
		
		if(Loading.inProgress)
			LoadingScreen();
		else if(Menu.active !== null){
			NavigateGUI();
			Menu.active.run();
			if(Menu.animating)
				AnimateMenu();
		} else if(Game.started && !Game.pause)
			GameLogic();
		
		if(Game.debugMode)
			DebugInfo();
		
		gameRender.drawImage(guiCanvas, 0, 0);
	}
}
UpdateMultiplier(Game.updateInterval);
LoadGame();
ScreenSize();
GameLoop();
