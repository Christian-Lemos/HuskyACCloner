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

let ACSchema = new mongoose.Schema({
    name: {
        type : String,
        unique : true,
        required : true,  
        lowercase: true, 
        trim: true      
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
  */

/**
 * @typedef ACDocument
 * @property {String} name
 * @property {Array.<Command>} commands
 * @property {function} save
*/


module.exports = mongoose.model("ac_commands", ACSchema);