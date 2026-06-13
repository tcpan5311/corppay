import Dashboard from '@/components/dashboard_components'
import { ScrollView } from 'react-native'
import "../../global.css"
 
export default function HomeScreen() 
{
	return (
		<ScrollView className="flex-1 bg-[#F4F6FA]">
			<Dashboard />
		</ScrollView>
	)
}