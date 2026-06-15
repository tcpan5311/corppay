import Dashboard from '@/components/dashboard_components'
import { ScrollView } from 'react-native'
import "../../global.css"

// Renders the home tab containing the primary dashboard view.
export default function HomeScreen()
{
	return (
		<ScrollView className="flex-1 bg-[#F4F6FA]">
			<Dashboard />
		</ScrollView>
	)
}
