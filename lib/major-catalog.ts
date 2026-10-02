export type MajorMeta={label:string;terms:string[];category?:string};
const aliases:[RegExp,string,string[],string?][]=[
[/^Business Administration and Management, General$/i,'Business Administration',['business','management'],'Business'],
[/^Business\/Commerce, General$/i,'Business',['business'],'Business'],
[/^Accounting$/i,'Accounting',['accounting'],'Business'],[/^Finance, General$/i,'Finance',['finance'],'Business'],[/^Marketing\/Marketing Management, General$/i,'Marketing',['marketing'],'Business'],
[/^Biology\/Biological Sciences, General$/i,'Biology',['biology'],'Science'],
[/^Computer Science$/i,'Computer Science',['computer science','computing'],'Computing'],[/^Information Technology$/i,'Information Technology',['it','information technology'],'Computing'],[/^Computer Engineering, General$/i,'Computer Engineering',['computer engineering'],'Engineering'],
[/^Mechanical Engineering$/i,'Mechanical Engineering',['engineering'],'Engineering'],[/^Civil Engineering, General$/i,'Civil Engineering',['engineering'],'Engineering'],[/^Electrical and Electronics Engineering$/i,'Electrical Engineering',['engineering'],'Engineering'],[/^Chemical Engineering$/i,'Chemical Engineering',['engineering'],'Engineering'],[/^Bioengineering and Biomedical Engineering$/i,'Biomedical Engineering',['engineering'],'Engineering'],
[/^Aerospace, Aeronautical, and Astronautical\/Space Engineering, General$/i,'Aerospace Engineering',['aerospace','aeronautical','engineering'],'Engineering'],[/^Aeronautical\/Aerospace Engineering Technology\/Technician$/i,'Aerospace Engineering Technology',['aerospace technology','engineering technology'],'Engineering Technology'],
[/^Registered Nursing\/Registered Nurse$/i,'Nursing (RN)',['nursing','registered nurse','rn'],'Health'],
[/^Psychology, General$/i,'Psychology',['psychology'],'Social Science'],[/^Criminal Justice\/Safety Studies$/i,'Criminal Justice',['criminal justice'],'Public Service'],[/^(?:Kinesiology and Exercise Science|Exercise Science and Kinesiology)$/i,'Kinesiology / Exercise Science',['kinesiology','exercise science'],'Health'],[/^Sport and Fitness Administration\/Management$/i,'Sports Management',['sports management','sport management'],'Business'],
[/^Communication, General$/i,'Communication',['communications'],'Communication'],[/^Journalism$/i,'Journalism',['journalism'],'Communication'],[/^Graphic Design$/i,'Graphic Design',['graphic design'],'Arts'],
[/^Elementary Education and Teaching$/i,'Elementary Education',['education','teaching'],'Education'],[/^Early Childhood Education and Teaching$/i,'Early Childhood Education',['education','teaching'],'Education'],[/^Special Education and Teaching, General$/i,'Special Education',['education','teaching'],'Education']
];
export function majorMeta(m:string):MajorMeta{for(const[a,label,terms,category]of aliases)if(a.test(m))return{label,terms,category};return{label:m.replace(/, General$/,'').replace(/\/General$/,''),terms:[]}}
export const majorLabel=(m:string)=>majorMeta(m).label;
