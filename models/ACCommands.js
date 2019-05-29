const mongoose = require('mongoose');


let temperature = new mongoose.Schema({
    output : {
        type : Number,
        required : true,
    },
    encodedSignal: {
        type : String,
        required : true
    }
})

let command = new mongoose.Schema({
    mode : {
        type : Number,
        required : true,
    },
    temperatures : [temperature]
})

let acModel = new mongoose.Schema({
    acModel: {
        type : String,
        unique : true,
        required : true,        
    },
    commands: [command]
})

/**
 * @typedef Temperature
 * @property {Number} output
 * @property {String} encodedSignal
 */

 /**
  * @typedef Command
  * @property {Number} mode
  * @property {Array.<Temperature>} temperatures
  * @property {function} save
  */

/**
 * @typedef ACDocument
 * @property {String} acModel
 * @property {Array.<Command>} commands
*/

module.exports = mongoose.model("ac_commands", acModel);