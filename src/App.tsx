import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editor from './pages/Editor';
import Print from './pages/Print';
import ConsignmentLayout from './pages/consignment/Layout';
import ConsignmentHome from './pages/consignment/Home';
import Shops from './pages/consignment/Shops';
import Products from './pages/consignment/Products';
import Deliveries from './pages/consignment/Deliveries';
import Returns from './pages/consignment/Returns';
import Settlements from './pages/consignment/Settlements';
import SettlementDetail from './pages/consignment/SettlementDetail';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/print/:id" element={<Print />} />
        <Route path="/consignment" element={<ConsignmentLayout />}>
          <Route index element={<ConsignmentHome />} />
          <Route path="shops" element={<Shops />} />
          <Route path="products" element={<Products />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="returns" element={<Returns />} />
          <Route path="settlements" element={<Settlements />} />
          <Route path="settlements/:id" element={<SettlementDetail />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
