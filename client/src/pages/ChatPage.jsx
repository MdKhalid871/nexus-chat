import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import RightPanel from '../components/RightPanel';
import Overlays from '../components/Overlays';

export default function ChatPage() {
  return (
    <div className="flex h-screen mesh-bg overflow-hidden">
      <Sidebar />
      <ChatArea />
      <RightPanel />
      <Overlays />
    </div>
  );
}
