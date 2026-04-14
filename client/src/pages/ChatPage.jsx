import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import Overlays from '../components/Overlays';

export default function ChatPage() {
  return (
    <div className="flex h-screen app-bg overflow-hidden">
      <Sidebar />
      <ChatArea />
      <Overlays />
    </div>
  );
}