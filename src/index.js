import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import JoinRoom from './components/joinRoom'
import WaitingRoom from './components/waitingRoom'
import AddTopic from './components/addTopic'
import DrawTopic from './components/drawTopic'
import ViewDraws from './components/viewDraws'

ReactDOM.render(
	<Router>
		<Routes>
			<Route path='/' element={<App />}></Route>
			<Route path='/join' element={<JoinRoom />}></Route>
			<Route path='/waiting' element={<WaitingRoom />}></Route>
			<Route path='/topic' element={<AddTopic />}></Route>
			<Route path='/draw' element={<DrawTopic />}></Route>
			<Route path='/view' element={<ViewDraws />}></Route>
			<Route path='/leaders'></Route>
		</Routes>
	</Router>,
	document.getElementById('root')
)
