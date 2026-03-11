'use client';

import { STATUS_LABELS } from '@/lib/constants';
import type { OrderStatus, OrderType } from '@/lib/types';

const PICKUP_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'picked_up'];
const DELIVERY_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

export default function OrderTimeline({
  status,
  orderType,
}: {
  status: OrderStatus;
  orderType: OrderType;
}) {
  const statuses = orderType === 'delivery' ? DELIVERY_STATUSES : PICKUP_STATUSES;
  const currentIndex = statuses.indexOf(status);

  return (
    <div className="flex items-center gap-1 w-full">
      {statuses.map((s, i) => {
        const isComplete = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={s} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={`flex-1 h-1 ${i <= currentIndex ? 'bg-accent' : 'bg-gray-200'}`} />
              )}
              <div
                className={`w-4 h-4 rounded-full flex-shrink-0 ${
                  isCurrent
                    ? 'bg-accent ring-4 ring-accent/20'
                    : isComplete
                    ? 'bg-accent'
                    : 'bg-gray-200'
                }`}
              />
              {i < statuses.length - 1 && (
                <div className={`flex-1 h-1 ${i < currentIndex ? 'bg-accent' : 'bg-gray-200'}`} />
              )}
            </div>
            <span className={`text-xs mt-2 text-center ${isCurrent ? 'font-semibold text-accent' : 'text-gray-400'}`}>
              {STATUS_LABELS[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
