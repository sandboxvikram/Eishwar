import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => (
  <div className="overflow-x-auto">
    <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
      {children}
    </table>
  </div>
);

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => (
  <thead className={`bg-gray-50 ${className}`}>
    {children}
  </thead>
);

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => (
  <tbody className={`bg-white divide-y divide-gray-200 ${className}`}>
    {children}
  </tbody>
);

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '' }) => (
  <tr className={`hover:bg-gray-50 ${className}`}>
    {children}
  </tr>
);

interface TableHeadProps {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '', colSpan, rowSpan }) => (
  <th
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
    colSpan={colSpan}
    rowSpan={rowSpan}
  >
    {children}
  </th>
);

interface TableCellProps {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '', colSpan, rowSpan }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`} colSpan={colSpan} rowSpan={rowSpan}>
    {children}
  </td>
);