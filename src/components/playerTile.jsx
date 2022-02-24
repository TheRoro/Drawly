import React from 'react'

const PlayerTile = ({ nickname, bgColor }) => {
	return (
		<li
			className={`${bgColor} flex items-center space-x-6 px-6 py-2 w-full rounded-lg mb-2`}
		>
			<div className='shrink-0'>
				<img
					className='h-14 w-14 object-cover rounded-full'
					src={`https://avatars.dicebear.com/api/bottts/${nickname}.svg`}
					alt='player avatar'
				/>
			</div>
			<label className='block'>
				<span className='font-semibold text-lg'>{nickname}</span>
			</label>
		</li>
	)
}

export default PlayerTile
