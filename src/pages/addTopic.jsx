import { useNavigate } from 'react-router-dom'
import SubmitButton from '../components/submitButton'

const AddTopic = () => {
	let navigate = useNavigate()

	return (
		<section className='w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col justify-center items-center'>
			<h2 className='font-pacifico text-5xl text-ink-200 text-center mb-5'>
				Add Drawing Topic
			</h2>
			<div className='w-full max-w-xs'>
				<form
					className='px-8 pt-6 pb-8 mb-4'
					autoComplete='off'
					onSubmit={(e) => {
						e.preventDefault()
						localStorage.setItem('topic', e.target.topic.value)
						navigate('/draw')
					}}
				>
					<div className='mb-4'>
						<input
							className='bg-paper-300 shadow-inner appearance-none border-none rounded w-full py-3 px-4 font-400 text-lg text-ink-200 placeholder-ink-100 focus:outline-0'
							id='topic'
							type='text'
							placeholder='Be Creative'
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

export default AddTopic
