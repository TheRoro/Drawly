import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import CanvasDraw from 'react-canvas-draw'

const DrawTopic = () => {
	const [topic, setTopic] = useState()
	let navigate = useNavigate()
	const canvasRef = useRef(null)

	useEffect(() => {
		setTopic(localStorage.getItem('topic'))
	}, [])

	return (
		<section className='w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col justify-center items-center'>
			<h3 className='text-2xl text-ink-100 text-start mb-2'>Your topic is</h3>
			<h2 className='font-pacifico text-5xl text-ink-200 text-center mb-10'>
				"{topic}"
			</h2>
			<div className='bg-ink-200 p-5 rounded-2xl'>
				<CanvasDraw
					ref={canvasRef}
					className='rounded-2xl'
					hideGrid={true}
					canvasWidth={900}
					canvasHeight={350}
					brushRadius={2}
				/>
			</div>
			<div className='flex items-center justify-between'>
				<button
					className='transition ease-in-out bg-blue-300 hover:bg-blue-400 w-72 py-3 px-4 font-medium text-xl rounded-lg shadow mt-10'
					type='button'
					onClick={() => {
						localStorage.setItem(
							'savedDrawing',
							canvasRef.current.getSaveData()
						)
						navigate('/view')
					}}
				>
					Finish Drawing
				</button>
			</div>
		</section>
	)
}

export default DrawTopic
