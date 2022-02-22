import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PlayerTile from '../components/playerTile'

const WaitingRoom = () => {
	let navigate = useNavigate()
	const [playerList] = useState([
		'TheRoro',
		'Vilaron',
		'Ninja',
		'K1000A',
		'JoeJonas',
	])

	const startGame = () => {
		navigate('/topic')
	}

	return (
		<section className='w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col justify-center items-center'>
			<h2 className='font-pacifico text-5xl text-ink-200 text-center mb-5'>
				Waiting for players...
			</h2>
			<div className='flex justify-center mt-4'>
				<ul className='bg-transparent rounded-lg w-96'>
					{playerList.map((nickname, key) => {
						return (
							<PlayerTile
								key={key}
								nickname={nickname}
								bgColor='bg-paper-300'
							/>
						)
					})}
				</ul>
			</div>
			<div className='flex items-center justify-between mt-5'>
				<button
					className='transition ease-in-out bg-blue-300 hover:bg-blue-400 w-72 py-3 px-4 font-medium text-xl rounded-lg shadow mt-10'
					type='button'
					onClick={() => {
						startGame()
					}}
				>
					Start Game
				</button>
			</div>
		</section>
	)
}

export default WaitingRoom
