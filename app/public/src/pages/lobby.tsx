import React, { Component } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Chat from './component/chat';
import CurrentUsers from './component/current-users';
import RoomMenu from './component/room-menu';
import TabMenu from './component/tab-menu';
import firebase from 'firebase/compat/app';
import { FIREBASE_CONFIG } from './utils/utils';
import { Client } from 'colyseus.js';
import DiscordButton from './component/discord-button';
import DonateButton from './component/donate-button';
import PolicyButton from './component/policy-button';
import CreditsButton from './component/credits-button';
import Wiki from './component/wiki';
import TeamBuilder from './component/team-builder';
import MetaReport from './component/meta-report';

interface LobbyState {
    messages: any[],
    users: any,
    user: any,
    searchedUser: any,
    leaderboard: any[],
    botLeaderboard: any[],
    currentText: string,
    allRooms: any[],
    isSignedIn: boolean,
    preparationRoomId: string,
    tabIndex: number,
    showWiki: boolean,
    showBuilder: boolean,
    pasteBinUrl: string,
    botData: any,
    meta: any[],
    metaItems: any[],
    showMeta: boolean,
    botList: any[],
    roomCreated: boolean
}

class Lobby extends Component<{},LobbyState> {
    client: Client;
    uid: string;
    room: any;
    _ismounted: boolean;

    constructor(props: any){
        super(props);

        this.state = {
            messages: [],
            users: {},
            user:{},
            searchedUser:{},
            leaderboard: [],
            botLeaderboard: [],
            currentText: '',
            allRooms: [],
            isSignedIn: false,
            preparationRoomId: '',
            tabIndex: 0,
            showWiki: false,
            showBuilder: false,
            pasteBinUrl: '',
            botData: {},
            meta: [],
            metaItems: [],
            showMeta: false,
            botList: [],
            roomCreated: false
        };

        const endpoint = `${window.location.protocol.replace('http', 'ws')}//${window.location.host}`;
        this.client = new Client(endpoint);

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        } 

        firebase.auth().onAuthStateChanged(user => {
            this.setState({isSignedIn: !!user});
            if(user){
                this.uid = firebase.auth().currentUser.uid;

                firebase.auth().currentUser.getIdToken().then(token =>{
                    this.client.joinOrCreate('lobby', {idToken: token})
                    .then(room=>{
                        this.room = room;
                        this.room.state.messages.onAdd = (m) => {this.setState({messages: this.room.state.messages})};
                        this.room.state.messages.onRemove = (m) => {this.setState({messages: this.room.state.messages})};
        
                        this.room.state.users.onAdd = (u) => {
                            if(u.id == this.uid){
                                this.setState({
                                                user: u,
                                                searchedUser: u
                                            });
                            }
                            u.onChange = () =>{
                                this.setState({users: this.room.state.users});
                            };
                            this.setState({users: this.room.state.users});
                        };
                        this.room.state.users.onRemove = (u) => {this.setState({users: this.room.state.users})};
        
                        this.room.state.leaderboard.onAdd = (l) => {this.setState({leaderboard: this.room.state.leaderboard})};
                        this.room.state.leaderboard.onRemove = (l) => {this.setState({leaderboard: this.room.state.leaderboard})};
                        
                        this.room.state.botLeaderboard.onAdd = (l) => {this.setState({botLeaderboard: this.room.state.botLeaderboard})};
                        this.room.state.botLeaderboard.onRemove = (l) => {this.setState({botLeaderboard: this.room.state.botLeaderboard})};

                        this.room.onMessage('pastebin-url', (json) =>{
                            this.setState({
                                pasteBinUrl: json.url
                            });
                        });

                        this.room.onMessage('rooms', (rooms) => {
                            rooms.forEach(room =>{
                              if(room.name == 'room'){
                                this.setState({allRooms: this.state.allRooms.concat(room)});
                              }
                            });
                          });

                        this.room.onMessage('bot-list', (bots)=>{
                            this.setState({
                                botList: bots
                            });
                        });
                      
                        this.room.onMessage('+', ([roomId, room]) => {
                            if(room.name == 'room' && this._ismounted){
                                const roomIndex = this.state.allRooms.findIndex((room) => room.roomId === roomId);
                                if (roomIndex !== -1) {
                                    let allRooms = [...this.state.allRooms];
                                    allRooms[roomIndex] = room;
                                    this.setState({allRooms: allRooms});
                                } 
                                else {
                                    this.setState({allRooms: this.state.allRooms.concat(room)});
                                }
                            }
                        });
                    
                        this.room.onMessage('-', (roomId) => {
                            if(this._ismounted){
                                const allRooms = this.state.allRooms.filter((room) => room.roomId !== roomId);
                                this.setState({allRooms: allRooms});
                            }
                        });

                        this.room.onMessage('user', (user)=>{
                            this.setState({
                                searchedUser: user
                            });
                        });

                        this.room.onMessage('meta', (meta)=>{
                            this.setState({
                                meta: meta
                            });
                        });

                        this.room.onMessage('metaItems', (metaItems)=>{
                            this.setState({
                                metaItems: metaItems
                            });
                        });

                        this.room.onMessage('bot-data', (data) => {
                            this.setState({
                                botData: data
                            })
                        })
                    });
                });
            }
        });
    }

    handleSubmit (e) {
        e.preventDefault()
        this.sendMessage(this.state.currentText);
        this.setState({currentText: ''});
    }
    
    setCurrentText (e) {
        e.preventDefault();
        this.setState({ currentText: e.target.value });
    }

    sendMessage(payload){
        this.room.send('new-message', {'name': this.state.user.name, 'payload': payload, 'avatar':this.state.user.avatar });
    }

    createBot(bot){
        this.room.send('bot-creation',{'bot': bot});
    }

    createRoom() {
        if(!this.state.roomCreated){
            firebase.auth().currentUser.getIdToken().then(token =>{
                this.client.create('room', {idToken: token, ownerId: this.uid}).then((room) => {
                    this.setState({roomCreated: true});
                    this.closeConnection(room);
                }).catch((e) => {
                  console.error('join error', e);
                  alert(e);
                });
            });
        }
    }

    logOut(){
        this.room.leave();
        firebase.auth().signOut();
    }

    joinRoom(id){
        firebase.auth().currentUser.getIdToken().then(token =>{
            this.client.joinById(id, {idToken: token}).then((room) => {
                this.closeConnection(room);
            }).catch((e) => {
              console.error('join error', e);
              alert(e);
            });
        });
    }

    closeConnection(room){
        this.room.leave();
        let id = room.id;
        localStorage.setItem('lastRoomId', id);
        localStorage.setItem('lastSessionId', room.sessionId);
        room.connection.close();
        this.setState({
            preparationRoomId: id
        });
    }

    changeAvatar(pokemon){
        this.room.send('avatar', {'pokemon': pokemon});
    }

    changeMap(map, index){
        this.room.send('map', {'map': map, 'index':index});
    }

    changeName(name){
        if(name.length > 3){
            firebase.auth().currentUser.updateProfile({displayName: name})
            .then(()=> {
                // Profile updated successfully!
                this.room.send('name', {'name': name});
              }, function(error) {
                console.log(error);
            });
        }
    }

    searchName(name){
        this.room.send('search', {'name':name});
    }

    displayInfo(name){
        this.setTabIndex(3);
        this.searchName(name);
    }

    setTabIndex(i){
        this.setState({
            tabIndex:i
        });
    }

    toggleMeta(){
        if(this.state.meta.length == 0 && !this.state.showMeta){
            this.room.send('meta');
        }
        this.setState((prevState)=>{
            return{
                showMeta: !prevState.showMeta
            }
        });
    }

    toggleWiki(){
        this.setState((prevState)=>{
            return{
                showWiki: !prevState.showWiki
            }
        });
    }

    toggleBuilder(){
        if(!this.state.showBuilder && !this.state.botList.length){
            this.room.send('bot-list-request');     
        }
        this.setState((prevState)=>{
            return{
                showBuilder: !prevState.showBuilder
            }
        });
    }

    requestBotData(botName){
        this.room.send('bot-data-request', botName)
    }

    render() {
        const lobbyStyle = {
            display:'flex',
            justifyContent:'space-between'
        };

        const buttonStyle= {
            marginLeft:'10px',
            marginTop:'10px',
            marginRight:'10px'
        }

      if(!this.state.isSignedIn){
        return <div>
        </div>;
      }
      if(this.state.preparationRoomId != ''){
        return <Navigate to='/preparation'/>;
      }
      if(this.state.showWiki){
        return <Wiki toggleWiki={this.toggleWiki.bind(this)} content='Lobby'/>;
      }
      if(this.state.showMeta){
          return <MetaReport toggleMeta={this.toggleMeta.bind(this)} meta={this.state.meta} metaItems={this.state.metaItems}/>;
      }
      if(this.state.showBuilder){
          return <TeamBuilder 
          toggleBuilder={this.toggleBuilder.bind(this)}
          createBot={this.createBot.bind(this)}
          pasteBinUrl={this.state.pasteBinUrl}
          botList={this.state.botList}
          botData={this.state.botData}
          requestBotData={this.requestBotData.bind(this)}
          />
      }
      else{
        return (
            <div className='App'>
                <div style={{display:'flex'}}>
                    <Link to='/auth'>
                            <button className='nes-btn is-error' style={buttonStyle} onClick={this.logOut.bind(this)}>Sign Out</button>
                    </Link>
                    <button className='nes-btn is-success' style={buttonStyle} onClick={this.toggleWiki.bind(this)}>Wiki</button>
                    <button className='nes-btn is-primary' style={buttonStyle} onClick={this.toggleBuilder.bind(this)}>BOT Builder</button>
                    <button className='nes-btn is-primary' style={buttonStyle} onClick={this.toggleMeta.bind(this)}>Meta Report</button>
                    <DiscordButton/>
                    <DonateButton/>
                    <PolicyButton/>
                    <CreditsButton/>
                </div>

                <div style={lobbyStyle}>

                <TabMenu
                    leaderboard={this.state.leaderboard}
                    botLeaderboard={this.state.botLeaderboard}
                    user={this.state.user}
                    searchedUser={this.state.searchedUser}
                    tabIndex={this.state.tabIndex}
                    changeAvatar={this.changeAvatar.bind(this)}
                    changeName={this.changeName.bind(this)}
                    changeMap={this.changeMap.bind(this)}
                    searchName={this.searchName.bind(this)}
                    setTabIndex={this.setTabIndex.bind(this)}
                    displayInfo={this.displayInfo.bind(this)}
                />
                <RoomMenu
                    allRooms={this.state.allRooms}
                    createRoom={this.createRoom.bind(this)}
                    joinRoom={this.joinRoom.bind(this)}
                />
                <CurrentUsers
                    users={this.state.users}
                    displayInfo={this.displayInfo.bind(this)}
                />
                <Chat 
                    messages={this.state.messages}
                    currentText={this.state.currentText}
                    handleSubmit={this.handleSubmit.bind(this)} 
                    setCurrentText={this.setCurrentText.bind(this)}
                    displayInfo={this.displayInfo.bind(this)}
                />
                </div>
            </div>
        );
      }
    }

    componentDidMount() { 
        this._ismounted = true;
  }
  
    componentWillUnmount() {
        this._ismounted = false;
  }
}
export default Lobby;