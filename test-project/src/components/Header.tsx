import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  const { t } = useTranslation();

  return (
    <header className="site-header">
      <div className="container">
        <div className="logo">
          <Link to="/">ProductName</Link>
        </div>
        <nav className="main-nav">
          <ul>
            <li><Link to="/products">Products</Link></li>
            <li><Link to="/solutions">Solutions</Link></li>
            <li><Link to="/pricing">Pricing</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </nav>
        <div className="cta-button">
          <Link to="/signup" className="btn btn-primary">{t('common.signup')}</Link>
        </div>
        <div className="tagline">
          <h2>Empower Your Business with Cutting-Edge Technology</h2>
          <p>Streamline workflows, boost productivity, and drive results with our comprehensive suite of tools.</p>
        </div>
      </div>
    </header>
  );
};

export default Header;