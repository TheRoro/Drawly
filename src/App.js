import { useNavigate } from 'react-router-dom'

const App = () => {
	let navigate = useNavigate()

	return (
		<section className='w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover'>
			<div className='w-full h-full p-12 flex flex-col lg:flex-row justify-center'>
				<div className='w-full lg:w-2/3 h-1/3 lg:h-full flex flex-col justify-center items-center lg:items-center p-5 gap-14'>
					<h1 className='font-pacifico text-9xl text-ink-200 text-center'>
						Drawly
					</h1>
					<h2 className='font-shadows text-7xl text-ink-200 text-center'>
						Fun With Friends
					</h2>
				</div>
				<div className='w-full lg:w-1/3 h-1/3 lg:h-full flex flex-col items-center lg:items-start justify-center p-5 gap-6'>
					<button
						className='transition ease-in-out bg-blue-300 hover:bg-blue-400 w-72 py-3 px-4 font-medium text-xl rounded-lg shadow mt-12'
						onClick={() => {
							navigate('/join')
						}}
					>
						Join Room
					</button>
					<button className='transition ease-in-out bg-emerald-300 hover:bg-emerald-400 w-72 py-3 px-4 font-medium text-xl rounded-lg shadow'>
						Create Room
					</button>
				</div>
			</div>
		</section>
	)
}

export default App
