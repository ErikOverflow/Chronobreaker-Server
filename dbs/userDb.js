const mongoose = require('mongoose');

const connection_uri = "mongodb://localhost:27017/riot";

mongoose.connect(connection_uri);

module.exports = exports = mongoose;