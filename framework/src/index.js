/*
     ____  ____  ____  ____  ____   __  _  _       
    (  _ \(  __)(  __)(  _ \(  _ \ /  \( \/ )      
     ) __/ ) _)  ) _)  )   / ) _ ((  O ))  (       
    (__)  (____)(____)(__\_)(____/ \__/(_/\_)      
*/
/**
 * Framework Entry Point
 * Exports ECS, rendering, and utilities
 */




// =============== ECS ===============
import { World } from './ecs/core/world.js';
import { GameLoop } from './ecs/core/gameloop.js';


// ECS helpers (optional)
import * as Components from './ecs/components/index.js';
import * as Systems from './ecs/systems/index.js';


// =============== Utilities ===============
// (You could add math helpers, ID generators, etc.)
//import generateRoomId from './signaling-server/utils/generateRoomId.js';
import * as Utils from './utils/index.js';

import * as User from './user/userUtils.js'

import SceneManager from './ecs/core/sceneManager.js';
import { Scene } from './ecs/core/scene.js';

// =============== Networking ===============
import SyncSystem from './networking/syncSystem.js';

import { Kinematics } from './ecs/kinematics.js';

// Export API
export {
  // ECS
  World,
  GameLoop,
  Components,
  Systems,
  Scene,
  SceneManager,

  // Networking
  SyncSystem,

  // Utilities
  Utils,
  User,
  Kinematics

};
