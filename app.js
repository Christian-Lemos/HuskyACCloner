const net = require('net');
const ip = require('ip');
const mongoose = require('mongoose');
const lodash = require('lodash')


const ACCommands = require('./models/ACCommands');


/**
 * @callback SocketConnectionCallback
 * @param {net.Socket} socket
 * @param {boolean} connected
*/

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
 * Calls all the IRCallbacks and removes nulls
 * @param {ACCloner} cloner
 * @param {ACCommands.ACDocument} document 
 * @param {Number} mode 
 * @param {Number} output 
 * @param {String} encodedSignal 
 */


function CallIRCallbacks(cloner, document, mode, output, encodedSignal)
{
    lodash.remove(cloner.IRCallbacks, (callback) =>
    {
        callback == null;
    })

    lodash.forEach(cloner.IRCallbacks, (callback) =>
    {
        callback(document, mode, output, encodedSignal)
    })
}

/**
 * Calls all ReadyCallbacks and removes nulls
 * @param {ACCloner} cloner
 */
function CallReadyCallbacks(cloner)
{
    lodash.remove(cloner.ReadyCallbacks, (callback) =>
    {
        callback == null;
    })

    lodash.forEach(cloner.ReadyCallbacks, (callback) =>
    {
        callback()
    })
}

/**
 * Call ListenCallbacks and removes nulls
 * @param {ACCloner} cloner
 * @param {Boolean} listening 
 */
function CallListenCallbacks(cloner, listening)
{
    lodash.remove(cloner.ListenCallbacks, (callback) =>
    {
        callback == null;
    })

    lodash.forEach(cloner.ListenCallbacks, (callback) =>
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

        /**
         * @type {number}
         */
        this.currentMode = null;

        /**
         * @type {number}
         */
        this.currentTemperature = null;


        this.server = new net.Server();

        /**
        * @type {net.Socket}
        */
        this.irSocket = null;


        /**
         * @type {Array.<OnIRSignalCallback>}
        */
        this.IRCallbacks = new Array();

        /**
         * @type {Array.<OnReadyCallback>}
        */
        this.ReadyCallbacks = new Array();

        /**
         * @type {Array.<OnListeningCallback>}
        */
        this.ListenCallbacks = new Array();

        /**
         * @type {Array.<SocketConnectionCallback>}
         */
        this.SocketConnectionCallbacks = new Array();

        mongoose.connect(mongoURI,
        {
            useNewUrlParser: true,
            useCreateIndex: true,
            user: mongoUser,
            pass: mongoPass
        }, () =>
        {
            this.server.on('connection', (socket) =>
            {
                if (!this.irSocket)
                {
                    this.irSocket = socket;

                    let close = () => {
                        this.irSocket = null;
                        lodash.forEach(this.SocketConnectionCallbacks, (callback) => {
                            try
                            {
                                callback(this.irSocket, false)
                            }
                            catch(err)
                            {
                                console.err(err)
                            }
                        })
                    }
                    this.irSocket.on('close', () => {
                        close();
                    })
                    this.irSocket.on('end', () => {
                        close();
                    })
                    this.irSocket.on('timeout', () => {
                        close();
                    })
                    this.irSocket.on('error', () => {
                        close();
                    })

                    lodash.forEach(this.SocketConnectionCallbacks, (callback) => {
                        try
                        {
                            callback(this.irSocket, true)
                        }
                        catch(err)
                        {
                            console.err(err)
                        }
                    })
                    
                    socket.on('data', (buffer) =>
                    {
                        let irEncodedSignal = String(buffer);
                        let update = this.currentMode != null && this.currentTemperature != null && this.currentModel != null;
                        
                        if (update)
                        {
                            let command = lodash.find(this.currentModel.commands, (command) =>
                            {
                                return command.mode == this.currentMode;
                            })

                            if (command != null)
                            {
                                let temperature = lodash.find(command.temperatures, (temperature) =>
                                {
                                    return temperature.output == this.currentTemperature
                                });

                                if (temperature != null)
                                {
                                    temperature.output == irEncodedSignal;
                                }
                                else
                                {
                                    command.temperatures.push(
                                    {
                                        output: this.currentTemperature,
                                        encodedSignal: irEncodedSignal
                                    });
                                }
                            }
                            else
                            {
                                this.currentModel.commands.push(
                                {
                                    mode: this.currentMode,
                                    temperatures: [
                                    {
                                        encodedSignal: irEncodedSignal,
                                        output: this.currentTemperature
                                    }]
                                });
                            }

                           // this.SaveCurrentModel();
                            CallIRCallbacks(this, this.currentModel, this.currentMode, this.currentTemperature, irEncodedSignal)
                        }
                        socket.write(String(update ? '1' : '0'));
                    });
                }
                else
                {
                    socket.end();
                }       
            });

            this.isReady = true;
            CallReadyCallbacks(this);
            
        });
    }
    
    StartListening()
    {
        let listen = () => 
        {
            this.server.listen(this.listeningPort, ip.address());
            this.server.on('listening', () =>
            {
                CallListenCallbacks(this, true);
            })
        }

    
        if(this.isReady)
        {
            listen();
        }
        else
        {
            let cloner = this;
            let callback = function() {
                lodash.remove(cloner.ReadyCallbacks, (c) => {
                    return c == callback;
                })
                listen();
            }
            this.OnReady(true, callback);
        }
    }

    StopListening()
    {
        if (this.irSocket)
        {
            this.irSocket.end();
        }
        this.server.close();
        CallListenCallbacks(this, false);
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

        this.ReadyCallbacks.push(callback);
        
    }

    /**
     * 
     * @param {boolean} force 
     * @param {SocketConnectionCallback} callback 
     */
    OnSocketConnection(force, callback)
    {
        if(force && this.irSocket != null)
        {
            callback(this.irSocket)
        }
        this.SocketConnectionCallbacks.push(callback)
    }

    /**
     * 
     * @param {OnListeningCallback} callback 
     */
    OnListening(callback)
    {
        this.ListenCallbacks.push(callback);
    }

    /**
     * 
     * @param {OnIRSignalCallback} callback 
     */
    OnIRSignal(callback)
    {
        this.IRCallbacks.push(callback);
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
            if(!mongoose.Types.ObjectId.isValid(id))
            {
                reject(new Error("Id is not valid."))
            }
            else
            {
                ACCommands.findById(id, (err, document) =>
                {
                    if (err)
                    {
                        reject(err);
                    }
                    else
                    {
                        this.currentModel = document;
                        resolve(document);
                    }
                })
            }

            
        })
    }

    SelectModelByName(name)
    {
        return new Promise((resolve, reject) =>
        {
            ACCommands.findOne((
            {
                name : name
            }), (err, document) =>
            {
                if (err)
                {
                    reject(err)
                }
                else
                {
                    this.currentModel = document;
                    resolve(document);
                }
            })
        })
    }

    SaveCurrentModel()
    {
        return this.currentModel.save();
    }

    SetMode(mode)
    {
        if (typeof(mode) != 'number')
        {
            throw new Error("Mode must be a number.")
        }
        this.currentMode= mode;
    }

    SetTemperature(temperature)
    {
        if (typeof(temperature) != "number")
        {
            throw new Error("Temperature must be a number.")
        }
        this.currentTemperature = temperature;
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
                    console.log(err);
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