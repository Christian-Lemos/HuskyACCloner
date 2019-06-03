let readline = require('readline')
let chalk = require('chalk')
let net = require('net');

const {ACCloner, ACCommands} = require('./../app')

/**
 * @type {ACCloner}
 */
let cloner;


const rl = readline.createInterface({
    input : process.stdin,
    output : process.stdout,
    historySize: 2,
    terminal : true
})


rl.question('Type mongoURI without the app (default is mongodb://localhost:27017): ', (uri) => {
    if(uri == '')
    {
        uri = "mongodb://localhost:27017"
    }
    rl.question("Type the mongoDB app: ", (app) => {
        rl.question('Type the mongoDB user: ', (user) => {
            rl.question("Type the mongoDB password: ", (pass) => {
                AskListeningPort((port) => {
                    cloner = new ACCloner(port, `${uri}/${app}`, user, pass)
                    SetClonerCalbacks(cloner);
                    SetRLCallbacks();
                    cloner.StartListening();
                })
            })
        })
    })
})


function AskListeningPort(callback)
{
    rl.question("Type the listening port (default is 4131): ", (_port) => {
        if(_port == "")
        {
            callback(4131)
        }
        else if(!isNaN(_port))
        {
            callback(Number(_port))
        }
        else
        {
            rl.write('Error: The listening port must be a number');
            AskListeningPort(callback);
        }
    })
}
/**
 * 
 * @param {ACCloner} cloner 
 */
function SetClonerCalbacks(cloner)
{

    cloner.OnListening((isListening) => {
        
        console.log(`Cloner ${isListening ? chalk.green("is listening") : chalk.red('stopped listening')}`)
        
    })

    cloner.OnSocketConnection(true, (socket, connected) => {
        console.log(`Socket ${connected ? chalk.green("connected") : chalk.red('disconnected')}`)
    })

    cloner.OnIRSignal((document, mode, output, encodedSignal) => {
        console.log(`${encodedSignal} set for ${document.name} with mode ${chalk.green(mode)} and output ${chalk.green(output)}`)
    })

}

function SetRLCallbacks()
{

    cloner.OnSocketConnection(true, (socket, connected) => {
        connected ? rl.resume() : rl.close();
    })

    rl.on('line', (input) => {
        input.trim();
        input = input.toLowerCase();
        input = input.replace(/ +(?= )/g, '')

        let split = input.split(' ');
        
        let command = split[0];
        let value = split[1];

        if(command == null || command == "")
        {
            console.log(`${chalk.red("Invalid command")}`)
            return;
        }

        if(command == "setmode" || command == "sm")
        {
            if(value == null || value == "")
            {
                console.log(`${chalk.red("Invalid value")}`)
                return;
            }

            if(isNaN(value))
            {
                console.log(`${chalk.red("Value must be a number")}`)
            }
            else
            {
                let number = Number(value);
                cloner.SetMode(number);
                console.log(`Mode set to ${chalk.green(value)}`)
            }
        }
        else if(command == "settemperature" || command == "setoutput" || command == "so" || command == "st")
        {
            if(value == null || value == "")
            {
                console.log(`${chalk.red("Invalid value")}`)
                return;
            }
            if(isNaN(value))
            {
                console.log(`${chalk.red("Value must be a number")}`)
            }
            else
            {
                let number = Number(value);
                cloner.SetTemperature(number);
                console.log(`Temperature set to ${chalk.green(value)}`)
            }
        }
        else if(command == "select")
        {
            if(value == null || value == "")
            {
                console.log(`${chalk.red("Invalid value")}`)
                return;
            }

            cloner.SelectModelByName(value)
                .then(document => {
                    if(document == null)
                    {
                        cloner.SelectModelById(value)
                            .then((document) => {
                                if(document)
                                {
                                    console.log(`Selected ${chalk.green(document.name)}`);
                                }
                                else
                                {
                                    console.log(`${value} ${chalk.red("not found.")}`);
                                }
                            })
                            .catch(err => {
                                console.log(`${value} ${chalk.red("not found.")}`);
                            });
                    }
                    else
                    {
                        console.log(`Selected ${chalk.green(document.name)}`);
                    }
                })
        }
        else if(command == "create")
        {
            if(value == null || value == "")
            {
                console.log(`${chalk.red("Invalid value")}`)
                return;
            }
            cloner.CreateModel(value, false)
                .then((document) => {
                    console.log(`${value} ${chalk.green("created")}`)
                });
        }
        else if(command == "save")
        {
            cloner.SaveCurrentModel();
        }
        else if(command == "list")
        {
            
            ACCommands.find({}, (err, documents) => {
                if(err)
                {
                    console.err(err);
                }
                else
                {
                    let string = '';

                    for(let i = 0; i < documents.length; i++)
                    {
                        string += `${documents[0].name}, `
                    }

                    string = string.substr(0, string.length - 2);

                    console.log(string);
                }
            })
        }
        else{
            confirm.log(`${chalk.red("Unknown command ")}`)
        }


    })
}


