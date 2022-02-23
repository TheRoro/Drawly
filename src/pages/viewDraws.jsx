import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import CanvasDraw from 'react-canvas-draw'
import AccentButton from '../components/accentButton'

const ViewDraws = () => {
	const [roomId, setRoomId] = useState()
	let navigate = useNavigate()
	const canvasRef = useRef(null)

	useEffect(() => {
		canvasRef.current.loadSaveData(localStorage.getItem('savedDrawing'))
		setRoomId(localStorage.getItem('roomId'))
	}, [])

	return (
		<section className='w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover fixed'>
			<h2 className='font-pacifico text-5xl text-ink-200 text-center mt-10'>
				Vote for your favorite drawing
			</h2>
			<h3 className='font-shadows text-3xl text-ink-200 text-center mt-5 mb-10'>
				{roomId}
			</h3>
			<div className=' grid grid-cols-3 gap-4'>
				<div className='flex items-center flex-col'>
					<h2 className='text-3xl text-ink-200 text-center mb-5'>An Apple</h2>
					<div className='bg-ink-200 p-1 rounded-2xl w-fit'>
						<CanvasDraw
							ref={canvasRef}
							className='rounded-2xl'
							hideGrid={true}
							canvasWidth={300}
							canvasHeight={150}
							brushRadius={2}
							disabled={true}
						/>
					</div>
				</div>
				<div className='flex items-center flex-col'>
					<h2 className='text-3xl text-ink-200 text-center mb-5'>An Apple</h2>
					<div className='bg-ink-200 p-1 rounded-2xl w-fit'>
						<CanvasDraw
							ref={canvasRef}
							className='rounded-2xl'
							hideGrid={true}
							canvasWidth={300}
							canvasHeight={150}
							brushRadius={2}
							disabled={true}
						/>
					</div>
				</div>
				<div className='flex items-center flex-col'>
					<h2 className='text-3xl text-ink-200 text-center mb-5'>An Apple</h2>
					<div className='bg-ink-200 p-1 rounded-2xl w-fit'>
						<CanvasDraw
							ref={canvasRef}
							className='rounded-2xl'
							hideGrid={true}
							canvasWidth={300}
							canvasHeight={150}
							brushRadius={2}
							disabled={true}
						/>
					</div>
				</div>
				<div className='flex items-center flex-col'>
					<h2 className='text-3xl text-ink-200 text-center mb-5'>An Apple</h2>
					<div className='bg-ink-200 p-1 rounded-2xl w-fit'>
						<CanvasDraw
							ref={canvasRef}
							className='rounded-2xl'
							hideGrid={true}
							canvasWidth={300}
							canvasHeight={150}
							brushRadius={2}
							disabled={true}
						/>
					</div>
				</div>
				<div className='flex items-center flex-col'>
					<h2 className='text-3xl text-ink-200 text-center mb-5'>An Apple</h2>
					<div className='bg-ink-200 p-1 rounded-2xl w-fit'>
						<CanvasDraw
							ref={canvasRef}
							className='rounded-2xl'
							hideGrid={true}
							canvasWidth={300}
							canvasHeight={150}
							brushRadius={2}
							disabled={true}
						/>
					</div>
				</div>
			</div>
			<div className='flex items-center justify-center'>
				<AccentButton
					text='See Leaderboard'
					callback={() => {
						navigate('/leaders')
					}}
					bgColor='bg-emerald-300'
				/>
			</div>
		</section>
	)
}

export default ViewDraws
