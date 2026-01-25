import { useContext } from 'react';
import { LiveContext } from '../contexts/LiveContextCore';

export const useLive = () => {
    const context = useContext(LiveContext);
    if (!context) throw new Error('useLive must be used within a LiveProvider');
    return context;
};
