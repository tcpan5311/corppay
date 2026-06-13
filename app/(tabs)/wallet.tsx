import WalletScreen from '@/components/wallet_components'
import { ScrollView } from 'react-native'

export default function WalletTab() 
{
	return (
		<ScrollView className="flex-1 bg-[#F4F6FA]">
			<WalletScreen />
		</ScrollView>
	)
}