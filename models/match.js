const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TeamSchema = new Schema({
  teamId: Number,
  win: String,
});

const ParticipantSchema = new Schema({
  participantId: Number,
  teamId: Number,
  championId: Number,
  accountId: String,
});

const MatchSchema = new Schema({
  platformId: String,
  gameId: Number,
  gameCreation: Number,
  gameDuration: Number,
  queueId: Number,
  mapId: Number,
  seasonId: Number,
  gameMode: String,
  teams: [TeamSchema],
  participants: [ParticipantSchema],
});


const Match = mongoose.model("Match", MatchSchema);

module.exports = {
  Match,
};
