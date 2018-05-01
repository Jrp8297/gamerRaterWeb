//#using statements
var http = require('http');
var url = require('url');
var query = require('querystring');
var fs = require('fs');
var EventEmitter = require('events');

//read in our html file to serve back
var index = fs.readFileSync(__dirname + "/../client/PetritschJ_Project3.html");
var relevantData = [];
var finished = false;
var SteamId = "";
var barrierValue = 300000000;//set an initial value for the barrier unreasonably high.
var headers = {                 
                'Content-Type' : "application/json"
            }
//Use the dev port, or whichever port we were provided
var port = process.env.PORT || 3000;

//function to handle our HTTP web requests
function onRequest(req, res) {
    
  //parse the URL from a string to an object of usable parts
  var parsedUrl = url.parse(req.url);
  //grab the query string from the parsedURL and parse it
  //into a usable object instead of a string
  var params = query.parse(parsedUrl.query);
  
  console.dir(parsedUrl.pathname)  
    var director = parsedUrl.pathname.toString().split('&');
    console.dir(director);                                                 
   
    if(director[0] === "/search"){
        SteamId = director[1].split("=")[1];
        //console.log(SteamId);
        gameSearch(req, res, params);
        //console.log("Request Received");
        
    }
    else{
    //console.log("standard HTML sent");
    res.writeHead(200, { "Content-Type" : "text/html"} );
    //write html file into the response
    res.write(index);
    //send response to client
    res.end();
    }
  
}

//function to start the process of steam game reading and processing
function gameSearch(req, res, params) {
    for(var i =0; i<19; i++){
        relevantData[i] = new SecondaryDataType(-1, 0);
    }
    
    
    var body = undefined;
    var returnData =" ";
    var totalTime = 0;
    myListener = new EventEmitter();
    myListener.on('data', function(data){
        body+=data;
    });   
  
    var url = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=7F7C30813493BD6B4E2F58A50BDE4855&steamid=" + SteamId+"&format=json";
    //console.log(url);
    http.get(url,(resp) => {     
        resp.on('data', (piece)=>{
            body+= piece;            
        })
        resp.on('end', ()=>{            
            returnData = SplitPrimary(body, totalTime, res, returnData);  
        })
    });   
    
}
function SplitPrimary(body, totalTime, res, incReturnData){//This function takes in the first set of input, and cuts out only the data we need, passing that data on to the sort Relevent Function
    
    var rawData = JSON.stringify(body);
    var allgames=  rawData.split("{");    
    if(allgames.length > 2){
        //console.log(allgames);
        var gameCount = allgames[2];
        var dataHead = gameCount.split(",");
        incReturnData = "totalGames:" + (dataHead[0].split(":"))[1] + ";";
        //console.log(gameCount);
        
        for(var i =3; i < allgames.length; i++){// skip the first 3 segements, they aren't games
            
            var outerdata = allgames[i].split(":");
            var maxtime = outerdata[outerdata.length-1].split("}");
            var appID = outerdata[1].split(",");
            totalTime  += parseInt(maxtime[0])
            //returnData +=( " Game {appID:" + appID[0] + ", thisGameTime:" + maxtime[0] + "},");
            ////console.log(allgames[i]);        
            ////console.log(appID[0]); 
            ////console.log(maxtime[0]);
            
            SortRelevant(appID[0], parseInt(maxtime[0]));//pass the ID and the Time played on this game to sort function
        }
        incReturnData += "totalTime:" + totalTime + ";";    
        // for(var i =0; i<relevantData.length-1; i++){//iterate through the relevant data, and for now, print it        
        SecondaryRequest(incReturnData, 0, res);
        //}
        
        return incReturnData
        
    }
    else{
        res.writeHead(200, headers);            
        console.log(body);
        res.write(JSON.stringify(incReturnData));
        res.end(); 
    }
    
}

function SecondaryRequest( incReturnData, index, res){
    var body = undefined;
    appID = relevantData[index].appId;
    Time = relevantData[index].timeThisGame;
     var url = "http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=" + appID + "&key=7F7C30813493BD6B4E2F58A50BDE4855&steamid=" + SteamId;
    http.get(url,(resp) => { 
        
        resp.on('data', (piece)=>{
            body+= piece;            
        })
        
        resp.on('end', ()=>{
           //console.log("data read");
            var headers = {                   
                'Content-Type' : "application/json"
            }            
                   
            incReturnData = SplitSecondary(body, Time, incReturnData);    
            
             printToClient(index, incReturnData, res);
            if(index < relevantData.length -1){
                SecondaryRequest(incReturnData, index+1, res);
            }
            return incReturnData;
            
        })
    });      
    return incReturnData;
    
}

function SortRelevant(appID, timeThisGame){//This function sorts out the 20 most played games.   
    if(timeThisGame > 0){//if you haven't played the game, don't count it. 
        for(var i =0; i<relevantData.length; i++){//REALLLY slow sort
            if(timeThisGame > relevantData[i].timeThisGame ){//If we are bigger than this number
                var temp = new SecondaryDataType(appID, timeThisGame);
                relevantData.splice(i, 0, temp);
                relevantData.splice(21);//should remove the smallest(oldest) element
                break;
            }               
        } 
        ////console.log(relevantData);
    }
}    

function SplitSecondary(body, timeThisGame, incReturnData){//Takes in individual game data and processes it.
    
    
    var rawData = JSON.stringify(body);
    var totalChieves =0; var completedChieves =0;
    var toAppend ="";
    var allChieves=  rawData.split("{"); 
    var gameName = allChieves[2].split(",")
    toAppend = (" Game{" +gameName[1] + ", TimeThisGame:" + timeThisGame.toString());
    
    for(var i =3; i < allChieves.length; i++){// skip the first 3 segements, they aren't games
        var thisChieve = allChieves[i].split(":");
        var thisCheiveComplete = thisChieve[2].split("\"")[0].split(",")[0];//get me just the value that determines if the acheivement has been gottennpm sta        
        totalChieves +=1;
        if(thisCheiveComplete == '1'){
            completedChieves += 1;
        }
       
        
    }
    
    toAppend +=", AT: " + totalChieves + ", AC:" + completedChieves + " };";
    incReturnData+= toAppend;
   
    return incReturnData;
}


function SecondaryDataType(incAppID, incTimeThisGame){
    this.appId= incAppID;
    this.timeThisGame = incTimeThisGame;
}

function printToClient(inc, incReturnData, res){
    if(inc == relevantData.length-2){
    res.writeHead(200, headers);            
    res.write(JSON.stringify(incReturnData));
    res.end();  
    }
}


//start listening for web traffic
//all requests to go onRequest. 
//listening on the specified port
http.createServer(onRequest).listen(port);
//console.log("listening on port " + port);