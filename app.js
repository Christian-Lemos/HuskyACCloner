const net = require('net');
const ip = require('ip');
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
 * @type {String}
 */

class ACCloner
{
    constructor(port)
    {
        this.port = port;

        this.isReady = false;

        server.on('listening', () => {
           
        });

        server.on('connection', (socket) => {
            if(!irSocket)
            {
                irSocket = socket;

                socket.on('data', (data) => {
                   
                    
                });
            }
            else
            {
                socket.destroy();
            }
            
        });
    }

    Start()
    {
        server.listen(this.port, ip.address());
    }

    Stop()
    {
        if(irSocket)
        {
            irSocket.destroy();
        }
        server.close();
    }

}

/**
 * 
 * @param {net.Socket} socket 
 */
function SetUpIRSocket(socket)
{
    irSocket = socket;

    socket.on('data', (data) => {
        data
    });
}

new ACCloner(1234).Start();

require('mongoose').connect('mongodb://localhost/ucmr', () => {
    let abc = new ACCommands({
        acModel : "Tesla",
        commands : [
            {
                mode : 1,
                temperatures : [
                    {
                        output : 21,
                        encodedSignal : "123123123"
                    }
                ]
            }
        ]
    })
    abc.save();
})



