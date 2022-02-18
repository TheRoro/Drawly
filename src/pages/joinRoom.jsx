import { useNavigate } from 'react-router-dom'
import SubmitButton from '../components/submitButton'

const JoinRoom = () => {
	let navigate = useNavigate()

	const join = (e) => {
		e.preventDefault()
		localStorage.setItem('roomId', e.target.roomId.value)
		localStorage.setItem('nickname', e.target.nickname.value)
		navigate('/waiting')
	}

	return (
		<section className='w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col justify-center items-center'>
			<h2 className='font-pacifico text-5xl text-ink-200 text-center mb-5'>
				Join Room
			</h2>
			<div className='w-full max-w-xs'>
				<form
					className='px-8 pt-6 pb-8 mb-4'
					autoComplete='off'
					onSubmit={join}
				>
					<div className='mb-4'>
						<input
							className='bg-paper-300 shadow-inner appearance-none border-none rounded w-full py-3 px-4 font-400 text-lg text-ink-200 placeholder-ink-100 focus:outline-0'
							id='roomId'
							type='text'
							placeholder='Room Name'
						/>
					</div>
					<div className='mb-4'>
						<input
							className='bg-paper-300 shadow-inner appearance-none border-none rounded w-full py-3 px-4 font-400 text-lg text-ink-100 placeholder-ink-100 focus:outline-0'
							id='nickname'
							type='text'
							placeholder='Nickname'
						/>
					</div>
					<div className='flex items-center justify-center'>
						<SubmitButton text='Join Room' bgColor='bg-emerald-300' />
					</div>
				</form>
			</div>
		</section>
	)
}

export default JoinRoom
