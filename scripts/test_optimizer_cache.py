"""Compare cached and native MILP selections and diagnostic outputs."""
from precompute_all_parameters import optimizer,original_optimizer
matrix={'a':['x','y'],'b':['y','z'],'c':['z','w']}
parameters=dict(post_count=4,factor_scores={'a':{'score':.9}},demand_weights={'x':100,'y':50,'z':60,'w':40},coordinates={'a':(39,54),'b':(39.01,54),'c':(39.02,54)},exact_post_count=True,secondary_scores={'a':.2,'b':.8,'c':.4})
for count in [4,15,2,4]:
 values={**parameters,'post_count':count,'factor_scores':{'a':{'score':count}}}
 native_diagnostics={};cached_diagnostics={}
 native=original_optimizer(matrix,**values,optimization_diagnostics=native_diagnostics)
 cached=optimizer(matrix,**values,optimization_diagnostics=cached_diagnostics)
 assert native==cached,(count,native,cached)
 assert native_diagnostics==cached_diagnostics,(count,native_diagnostics,cached_diagnostics)
print('Native/cached optimizer agreement:',4,'cases')
