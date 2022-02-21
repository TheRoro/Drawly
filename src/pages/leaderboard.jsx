import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AccentButton from '../components/accentButton'
import PlayerTile from '../components/playerTile'

const LeaderBoard = () => {
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
			<h2 className='font-semibold text-4xl text-black'>Leaders</h2>
			<div className='flex justify-center mt-4'>
				<ol className='bg-transparent rounded-lg w-96'>
					{playerList.map(
						(nickname, key) =>
							(key === 0 && (
								<PlayerTile
									key={key}
									nickname={nickname}
									bgColor={'bg-golden'}
								/>
							)) ||
							(key === 1 && (
								<PlayerTile
									key={key}
									nickname={nickname}
									bgColor={'bg-silver'}
								/>
							)) ||
							(key === 2 && (
								<PlayerTile
									key={key}
									nickname={nickname}
									bgColor={'bg-bronze'}
								/>
							)) ||
							(key > 2 && (
								<PlayerTile
									key={key}
									nickname={nickname}
									bgColor={'bg-paper-300'}
								/>
							))
					)}
				</ol>
			</div>
			<div className='flex items-center justify-between mt-5'>
				<AccentButton
					text='Play Again'
					callback={startGame}
					bgColor='bg-emerald-300'
				/>
			</div>
		</section>
	)
}

export default LeaderBoard
