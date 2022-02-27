import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import JoinRoom from './pages/joinRoom'
import WaitingRoom from './pages/waitingRoom'
import AddTopic from './pages/addTopic'
import DrawTopic from './pages/drawTopic'
import ViewDraws from './pages/viewDraws'
import LeaderBoard from './pages/leaderboard'

ReactDOM.render(
	<Router>
		<Routes>
			<Route path='/' element={<App />}></Route>
			<Route path='/join' element={<JoinRoom />}></Route>
			<Route path='/waiting' element={<WaitingRoom />}></Route>
			<Route path='/topic' element={<AddTopic />}></Route>
			<Route path='/draw' element={<DrawTopic />}></Route>
			<Route path='/view' element={<ViewDraws />}></Route>
			<Route path='/leaders' element={<LeaderBoard />}></Route>
		</Routes>
	</Router>,
	document.getElementById('root')
)
