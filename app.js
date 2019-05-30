const net = require('net');
const ip = require('ip');
const mongoose = require('mongoose');
const lodash = require('lodash')

const ACCommands = require('./models/ACCommands');


/**
 * @callback OnReadyCallback
 */

let server = new net.Server();

/**
 * @type {net.Socket}
 */
let irSocket = null;


/**
 * @type {Number}
 */
let currentMode = null;

/**
 * @type {Number}
 */
let currentTemperature = null;

/**
 * Callback for listening observers
 * 
 * @callback OnListeningCallback
 * @param {Boolean} listening
 */

/**
 * Callback for ready observers
 * 
 * @callback OnReadyCallback
 */

/**
 * Callback for IR signal observers
 * 
 * @callback OnIRSignalCallback
 * @param {ACCommands.ACDocument} document
 * @param {Number} mode
 * @param {Number} output
 * @param {String} encodedSignal
 */


/**
 * @type {Array<OnIRSignalCallback>}
 */
let IRCallbacks = new Array();

/**
 * @type {Array<OnReadyCallback>}
 */
let ReadyCallbacks = new Array();

/**
 * @type {Array<OnListeningCallback>}
 */
let ListenCallbacks = new Array();

/**
 * Calls all the IRCallbacks and removes nulls
 * @param {ACCommands.ACDocument} document 
 * @param {Number} mode 
 * @param {Number} output 
 * @param {String} encodedSignal 
 */
function CallIRCallbacks(document, mode, output, encodedSignal)
{
    lodash.remove(IRCallbacks, (callback) =>
    {
        callback == null;
    })

    lodash.forEach(IRCallbacks, (callback) =>
    {
        callback(document, mode, output, encodedSignal)
    })
}

/**
 * Calls all ReadyCallbacks and removes nulls
 */
function CallReadyCallbacks()
{
    lodash.remove(ReadyCallbacks, (callback) =>
    {
        callback == null;
    })

    lodash.forEach(ReadyCallbacks, (callback) =>
    {
        callback()
    })
}

/**
 * Call ListenCallbacks and removes nulls
 * @param {Boolean} listening 
 */
function CallListenCallbacks(listening)
{
    lodash.remove(ListenCallbacks, (callback) =>
    {
        callback == null;
    })

    lodash.forEach(ListenCallbacks, (callback) =>
    {
        callback(listening)
    })
}

class ACCloner
{
    /**
     * 
     * @param {Number} listeningPort 
     * @param {String} mongoURI 
     * @param {String} mongoUser 
     * @param {String} mongoPass 
     */
    constructor(listeningPort, mongoURI, mongoUser, mongoPass)
    {
        /**
         * @type {Number}
         */
        this.listeningPort = listeningPort;

        /**
         * @type {Boolean}
         */
        this.isReady = false;

        /**
         * @type {ACCommands.ACDocument}
         */
        this.currentModel = null;


        mongoose.connect(mongoURI,
        {
            useNewUrlParser: true,
            useCreateIndex: true,
            user: mongoUser,
            pass: mongoPass
        }, () =>
        {
            server.on('connection', (socket) =>
            {
                if (!irSocket)
                {
                    irSocket = socket;

                    socket.on('data', (buffer) =>
                    {
                        let irEncodedSignal = String(buffer);

                        let update = currentMode != null && currentTemperature != null && this.currentModel != null;
                        if (update)
                        {
                            let command = lodash.find(this.currentModel.commands, (command) =>
                            {
                                return command.mode == currentMode;
                            })

                            if (command != null)
                            {
                                let temperature = lodash.find(command.temperatures, (temperature) =>
                                {
                                    return temperature.output == currentTemperature
                                });

                                if (temperature != null)
                                {
                                    temperature.output == irEncodedSignal;
                                }
                                else
                                {
                                    command.temperatures.push(
                                    {
                                        output: currentTemperature,
                                        encodedSignal: irEncodedSignal
                                    });
                                }
                            }
                            else
                            {
                                this.currentModel.commands.push(
                                {
                                    mode: currentMode,
                                    temperatures: [
                                    {
                                        encodedSignal: irEncodedSignal,
                                        output: currentTemperature
                                    }]
                                });
                            }

                            this.SaveCurrentModel();
                        }

                        CallIRCallbacks(this.currentModel, currentTemperature, currentTemperature, irEncodedSignal)

                        socket.write(String(update ? '1' : '0'));
                    });
                }
                else
                {
                    socket.end();
                }

                server.on('listening', () =>
                {
                    CallListenCallbacks(true);
                })

                this.isReady = true;
                CallReadyCallbacks();
            });
        });
    }

    StartListening()
    {
        server.listen(this.listeningPort, ip.address());
    }

    StopListening()
    {
        if (irSocket)
        {
            irSocket.end();
        }
        server.close();
        CallListenCallbacks(false);
    }

    /**
     * 
     * @param {Boolean} force 
     * @param {OnReadyCallback} callback 
     */
    OnReady(force, callback)
    {
        if (this.isReady && force)
        {
            callback();
        }
        else
        {
            ReadyCallbacks.push(callback);
        }
    }

    /**
     * 
     * @param {OnListeningCallback} callback 
     */
    OnListening(callback)
    {
        ListenCallbacks.push(callback);
    }

    /**
     * 
     * @param {OnIRSignalCallback} callback 
     */
    OnIRSignal(callback)
    {
        IRCallbacks.push(callback);
    }

    /**
     * Finds an ain conditioner model by it's Id and sets it has the current model
     * @param {string} id 
     * @returns {Promise<ACCommands.ACDocument>}
     */
    SelectModelById(id)
    {
        return new Promise((resolve, reject) =>
        {
            ACCommands.findById(id, (err, document) =>
            {
                if (err)
                {
                    reject(err);
                }
                else
                {
                    resolve(document);
                }
            })
        })
    }

    SelectModelByName(name)
    {
        return new Promise((resolve, reject) =>
        {
            ACCommands.findOne((
            {
                modelName: name
            }), (err, document) =>
            {
                if (err)
                {
                    reject(err)
                }
                else
                {
                    resolve(document);
                }
            })
        })
    }

    SaveCurrentModel()
    {
        return this.currentModel.save();
    }

    SetModeAndTemperature(mode, temperature)
    {

        if (typeof(mode) != 'number')
        {
            throw new Error("Mode must be a number.")
        }

        if (typeof(temperature) != "number")
        {
            throw new Error("Temperature must be a number.")
        }

        currentMode = mode;
        currentTemperature = temperature;
    }

    CreateModel(modelName, setCurrentModel)
    {
        return new Promise((resolve, reject) =>
        {
            /**
             * @type {ACCommands.ACDocument}
             */
            let model = {
                name: modelName
            }

            ACCommands.create([model], (err, documents) =>
            {
                if (err)
                {
                    reject(err)
                }
                else
                {
                    if (setCurrentModel)
                    {
                        this.currentModel = documents[0];
                    }
                    resolve(documents[0]);
                }
            })
        })
    }
}


module.exports = {
    ACCloner: ACCloner,
    ACCommands: ACCommands
}