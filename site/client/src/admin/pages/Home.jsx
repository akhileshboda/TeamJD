import WhatsNew from '../components/WhatsNew'
import HomeStats from './HomeStats'

// Page heading and period first, then What's new, then the numbers.
export default function Home() {
  return <HomeStats whatsNew={<WhatsNew />} />
}
