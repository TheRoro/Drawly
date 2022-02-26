import React, { useState, useEffect } from 'react'

const SubmitButton = ({ text, bgColor }) => {
	const [hoverBgColor, setHoverBgColor] = useState()

	useEffect(() => {
		let temp = bgColor.split('').reverse()
		temp[2] = (Number(temp[2]) + 1).toString()
		setHoverBgColor(temp.reverse().join(''))
	}, [bgColor])

	return (
		<button
			className={`transition ease-in-out ${bgColor} hover:${hoverBgColor} w-72 py-3 px-4 font-medium text-xl rounded-lg shadow mt-10`}
			type='submit'
		>
			{text}
		</button>
	)
}

export default SubmitButton
