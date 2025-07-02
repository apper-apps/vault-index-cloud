import * as Icons from 'lucide-react';

const ApperIcon = ({ name, ...props }) => {
    let IconComponent = Icons[name];
    if (!IconComponent) {
        console.warn(`Icon "${name}" does not exist in lucide-react`);
        IconComponent = Icons['Smile'];
    }
    return <IconComponent {...props} />;
};

export default ApperIcon;