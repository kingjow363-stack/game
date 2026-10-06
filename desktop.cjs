const {app,BrowserWindow}=require('electron');
const path=require('node:path');
let window;
function createWindow(){window=new BrowserWindow({width:1280,height:900,minWidth:430,minHeight:650,backgroundColor:'#0d1115',title:'EXO Industries',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(url!==window.webContents.getURL())event.preventDefault()});window.loadFile(path.join(__dirname,'index.html'));}
app.whenReady().then(createWindow);app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
