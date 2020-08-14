const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//Summoners rift max x and max y is 16000
const Position = new Schema({
    x: Number,
    y: Number,
  });

const TimelineParticipantFrame = new Schema({
    participantId: Number,
    minionsKilled: Number,
    teamScore: Number,
    dominionScore: Number,
    totalGold: Number,
    level: Number,
    xp: Number,
    currentGold: Number,
    position: Position,
    jungleMinionsKilled: Number,
  });

//In every frame, there are participant frames and event
const TimelineEvent = new Schema({
  timestamp: Number, //Time of the event
  participantId: Number, //Who was the main participant
  assistingParticipantIds: [Number],
  eventType: String, //Unknown what this is used for
  type: {
    type: String,
    enum: [
      "CHAMPION_KILL",
      "WARD_PLACED",
      "WARD_KILL",
      "BUILDING_KILL",
      "ELITE_MONSTER_KILL",
      "ITEM_PURCHASED",
      "ITEM_SOLD",
      "ITEM_DESTROYED",
      "ITEM_UNDO",
      "SKILL_LEVEL_UP",
      "ASCENDED_EVENT",
      "CAPTURE_POINT",
      "PORO_KING_SUMMON",
    ],
  },

  //Self actions
  skillSlot: Number, //Identifies which skill was leveled up
  afterId: Number, //Used to track the before and after state of an undo (bought -> undo (afterId would be 0), or sold -> undo(afterId would be the itemId))
  itemId: Number,
  beforeId: Number,
  creatorId: Number, //For tracking who placed wards

  levelUpType: String, //I just see "NORMAL"
  wardType: String, //Sight ward, blue trinket, yellow trinket, control ward

  towerType: String, //Outer, inner, base, inhibitor, nexus
  laneType: String, //Where the structure was located
  buildingType: String, //What type of building (tower vs inhibitor)
  teamId: Number, //Which team killed the building

  monsterType: String, //Rift herald, dragon, nashor
  monsterSubType: String, //Type of dragon

  position: Position, //Where the event occurred
  killerId: Number,
  assistingParticipantIds: [Number],
  victimId: Number,

  //ascendedType: String, //Used in other game modes?
  //pointCaptured: String //Used in other game modes?
});

const TimelineFrame = new Schema({
  participantFrames: [TimelineParticipantFrame],
  events: [TimelineEvent],
  timestamp: Number,
});

const TimelineSchema = new Schema({
  gameId: Number,
  frameInterval: Number,
  frames: [TimelineFrame],
});

const Timeline = mongoose.model("Timeline", TimelineSchema);

module.exports = {
  Timeline,
};
