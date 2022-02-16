module.exports = {
	content: ['./src/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			colors: {
				'paper-100': '#F9EDD1',
				'paper-200': '#EEE2C7',
				'paper-300': '#EADEC4',
				'ink-100': '#6B6B6B',
				'ink-200': '#383B3D',
				golden: '#FFD165',
				silver: '#E0E0E0',
				bronze: '#E7C679',
			},
			backgroundImage: {
				'paper-pattern': "url('/public/bg.svg')",
			},
			fontFamily: {
				pacifico: ['Pacifico'],
				shadows: ['"Shadows Into Light Two"'],
			},
		},
	},
	plugins: [],
}
