import WalletScreen from '@/components/wallet_components'
import { ScrollView } from 'react-native'

// Renders the wallet tab containing the wallet screen view.
export default function WalletTab()
{
	return (
		<ScrollView className="flex-1 bg-[#F4F6FA]">
			<WalletScreen />
		</ScrollView>
	)
}
